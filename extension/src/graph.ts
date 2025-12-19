import * as vscode from "vscode";
import * as fs from "fs";
import type {
  CallHierarchy,
  FunctionCall,
  CytoscapeGraph,
  CytoscapeNode,
  CytoscapeEdge,
} from "./types";

type AnalyzerFunc = (
  doc: vscode.TextDocument,
  pos: vscode.Position
) => Promise<{
  function: vscode.CallHierarchyItem;
  callers: vscode.CallHierarchyIncomingCall[];
  callees: vscode.CallHierarchyOutgoingCall[];
} | null>;

const toRel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);

export function toFuncCall(item: vscode.CallHierarchyItem): FunctionCall {
  const line = item.range.start.line + 1;
  return {
    name: item.name,
    filePath: toRel(item.uri),
    line: line,
  };
}

export function convertVsCodeHierarchy(rawHierarchy: {
  function: vscode.CallHierarchyItem;
  callers: vscode.CallHierarchyIncomingCall[] | undefined | null;
  callees: vscode.CallHierarchyOutgoingCall[] | undefined | null;
}): CallHierarchy {
  return {
    target: toFuncCall(rawHierarchy.function),
    incoming: (rawHierarchy.callers ?? []).map((c) => toFuncCall(c.from)),
    outgoing: (rawHierarchy.callees ?? []).map((c) => toFuncCall(c.to)),
  };
}

const encodeId = (id: string) => encodeURIComponent(id);

/**
 * Transforms the backend CallHierarchy data into a Cytoscape.js compatible graph format.
 * @param hierarchy The raw call hierarchy data from the analyzer.
 * @returns A CytoscapeGraph object (nodes and edges) ready for visualization.
 */
export function transformToCytoscapeGraph(hierarchy: CallHierarchy): CytoscapeGraph {
  const nodes: CytoscapeNode[] = [];
  const edges: CytoscapeEdge[] = [];
  const addedNodeIds = new Set<string>();

  const getUniqueId = (func: FunctionCall): string => {
    return `${func.name} @ ${func.filePath}:${func.line}`;
  };

  const addNode = (func: FunctionCall) => {
    const id = getUniqueId(func);
    if (!addedNodeIds.has(id)) {
      addedNodeIds.add(id);
      nodes.push({ data: { id: id, label: func.name } });
    }
  };

  const targetId = getUniqueId(hierarchy.target);
  addNode(hierarchy.target);

  for (const incomingFunc of hierarchy.incoming) {
    const incomingId = getUniqueId(incomingFunc);
    addNode(incomingFunc);
    edges.push({
      data: { id: `edge_${incomingId}_to_${targetId}`, source: incomingId, target: targetId },
    });
  }

  for (const outgoingFunc of hierarchy.outgoing) {
    const outgoingId = getUniqueId(outgoingFunc);
    addNode(outgoingFunc);
    edges.push({
      data: { id: `edge_${targetId}_to_${outgoingId}`, source: targetId, target: outgoingId },
    });
  }

  return { nodes, edges };
}

function encodeGraphIds(graph: CytoscapeGraph): CytoscapeGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      data: { id: encodeId(node.data.id), label: node.data.label },
    })),
    // [FIX] Safely handle optional ID without using non-null assertion (!)
    edges: graph.edges.map((edge) => ({
      data: {
        id: edge.data.id ? encodeId(edge.data.id) : undefined,
        source: encodeId(edge.data.source),
        target: encodeId(edge.data.target),
      },
    })),
  };
}

function parseNodeId(id: string): { name: string; filePath: string; line: number } | null {
  try {
    const rawId = decodeURIComponent(id);
    const match = rawId.match(/^(.*?) @ (.*):(\d+)$/);
    if (!match) return null;
    return { name: match[1], filePath: match[2], line: parseInt(match[3], 10) };
  } catch {
    return null;
  }
}

export function showGraphView(
  context: vscode.ExtensionContext,
  graph: CytoscapeGraph,
  targetNodeId: string,
  output: vscode.OutputChannel,
  getCallHierarchyAt: AnalyzerFunc
): void {
  const panel = vscode.window.createWebviewPanel(
    "thoughtflowGraph",
    "ThoughtFlow - Call Graph",
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "templates")],
    }
  );

  try {
    const htmlPath = vscode.Uri.joinPath(
      context.extensionUri,
      "dist",
      "templates",
      "graphView.html"
    );
    let htmlContent = fs.readFileSync(htmlPath.fsPath, "utf8");
    const cssUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "dist", "templates", "graphStyle.css")
    );
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "dist", "templates", "graphScript.js")
    );

    htmlContent = htmlContent
      .replace("${cssUri}", cssUri.toString())
      .replace("${scriptUri}", scriptUri.toString());
    panel.webview.html = htmlContent;

    panel.webview.postMessage({
      type: "INIT_GRAPH",
      data: encodeGraphIds(graph),
      targetId: encodeId(targetNodeId),
    });

    panel.webview.onDidReceiveMessage(
      async (message) => {
        // output.show(true);
        output.appendLine(`[DEBUG] Received message type: ${message.type}`);

        if (message.type === "NODE_TAPPED") {
          const tappedNodeId = message.payload.id;
          output.appendLine(`[Webview] Node tapped: ${tappedNodeId}`);

          const parsed = parseNodeId(tappedNodeId);
          if (!parsed) {
            output.appendLine(`[Extension] ❌ Failed to parse ID: ${tappedNodeId}`);
            return;
          }

          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) return;

          const fileUri = vscode.Uri.joinPath(workspaceFolders[0].uri, parsed.filePath);

          try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const zeroBasedLine = Math.max(0, parsed.line - 1);
            const lineText = doc.lineAt(zeroBasedLine).text;
            const nameIndex = lineText.indexOf(parsed.name);
            const pos = new vscode.Position(zeroBasedLine, nameIndex >= 0 ? nameIndex : 0);

            const rawHierarchy = await getCallHierarchyAt(doc, pos);
            if (!rawHierarchy) return;

            const hierarchyGraph = transformToCytoscapeGraph(convertVsCodeHierarchy(rawHierarchy));

            panel.webview.postMessage({
              type: "ADD_ELEMENTS",
              data: encodeGraphIds(hierarchyGraph),
            });
            output.appendLine(`[Extension] Sent new elements to webview`);
          } catch (e) {
            output.appendLine(`[ERROR] processing node tap: ${e}`);
          }
        }
      },
      undefined,
      context.subscriptions
    );
  } catch (error) {
    output.appendLine(`[ERROR] ${error}`);
  }
}
