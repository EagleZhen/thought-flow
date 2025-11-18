import * as vscode from "vscode";
import * as fs from "fs";
// Import all necessary types from types.ts
import type {
  CallHierarchy,
  FunctionCall,
  CytoscapeGraph,
  CytoscapeNode,
  CytoscapeEdge,
} from "@/types";
// Import the analyzer function to use its *type*
import { getCallHierarchyAt } from "@/analyzer";

// Define a type for the analyzer function so we can pass it as an argument.
// This is the signature of `getCallHierarchyAt`.
type AnalyzerFunc = (
  doc: vscode.TextDocument,
  pos: vscode.Position
) => Promise<{
  function: vscode.CallHierarchyItem;
  callers: vscode.CallHierarchyIncomingCall[];
  callees: vscode.CallHierarchyOutgoingCall[];
} | null>;

/**
 * Helper to get a workspace-relative path from a URI.
 * @param uri The URI to convert.
 */
const toRel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);

/**
 * [修复版] 将 VS Code CallHierarchyItem 转换为内部 FunctionCall 类型。
 * 关键修改：始终使用 item.range (定义位置) 来作为 ID 的一部分，忽略具体的调用行号。
 * 这确保了同一个函数在图中永远只有一个唯一的节点 ID。
 */
export function toFuncCall(item: vscode.CallHierarchyItem): FunctionCall {
  // 始终使用 item.range (定义范围)
  const line = item.range.start.line + 1;
  return {
    name: item.name,
    filePath: toRel(item.uri),
    line: line,
  };
}

/**
 * Helper to convert the raw VS Code hierarchy object into our internal CallHierarchy type.
 * @param rawHierarchy The raw output from `getCallHierarchyAt`.
 */
export function convertVsCodeHierarchy(rawHierarchy: {
  function: vscode.CallHierarchyItem;
  callers: vscode.CallHierarchyIncomingCall[];
  callees: vscode.CallHierarchyOutgoingCall[];
}): CallHierarchy {
  return {
    target: toFuncCall(rawHierarchy.function),
    // [修复] 只传递 item，不传递 range，避免 ID 包含调用位置
    incoming: rawHierarchy.callers.map((c) => toFuncCall(c.from)),
    // [修复] 只传递 item，不传递 range
    outgoing: rawHierarchy.callees.map((c) => toFuncCall(c.to)),
  };
}

// Encode ID for safe use in HTML/CSS (reversible with decodeURIComponent)
const encodeId = (id: string) => encodeURIComponent(id);

/**
 * Transforms the backend CallHierarchy data into a Cytoscape.js compatible graph format.
 * @param hierarchy The raw call hierarchy data from the analyzer.
 * @returns A CytoscapeGraph object (nodes and edges) ready for visualization.
 *
 * [FIXED] This function now *only* deals with RAW, un-encoded strings for all IDs.
 * Encoding is handled *only* by the `encodeGraphIds` function.
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
      nodes.push({
        data: {
          id: id,
          label: func.name, // The label shown on the graph
        },
      });
    }
  };

  // 1. Add the target node (the function the user clicked on)
  const targetId = getUniqueId(hierarchy.target);
  addNode(hierarchy.target);

  // 2. Process incoming calls (callers)
  // Edge direction: [Caller] ---> [Target]
  for (const incomingFunc of hierarchy.incoming) {
    const incomingId = getUniqueId(incomingFunc);
    addNode(incomingFunc); // Add the caller node

    // [FIX] Create a unique RAW (un-encoded) edge ID.
    const edgeId = `edge_${incomingId}_to_${targetId}`;

    edges.push({
      data: {
        id: edgeId, // <-- Store the RAW ID
        source: incomingId, // <-- Store the RAW ID
        target: targetId, // <-- Store the RAW ID
      },
    });
  }

  // 3. Process outgoing calls (callees)
  // Edge direction: [Target] ---> [Callee]
  for (const outgoingFunc of hierarchy.outgoing) {
    const outgoingId = getUniqueId(outgoingFunc);
    addNode(outgoingFunc); // Add the callee node

    // [FIX] Create a unique RAW (un-encoded) edge ID.
    const edgeId = `edge_${targetId}_to_${outgoingId}`;

    edges.push({
      data: {
        id: edgeId, // <-- Store the RAW ID
        source: targetId, // <-- Store the RAW ID
        target: outgoingId, // <-- Store the RAW ID
      },
    });
  }

  return { nodes, edges };
}

/**
 * Encode all IDs in graph for safe HTML/CSS use.
 * [FIXED] This function is now the *only* place encoding happens.
 * It correctly encodes the raw edge IDs from `transformToCytoscapeGraph` once.
 */
function encodeGraphIds(graph: CytoscapeGraph): CytoscapeGraph {
  return {
    nodes: graph.nodes.map((node) => ({
      data: {
        id: encodeId(node.data.id),
        label: node.data.label,
      },
    })),
    edges: graph.edges.map((edge) => ({
      data: {
        // [FIX] This now correctly encodes the RAW edge ID just once
        id: encodeId(edge.data.id!),
        source: encodeId(edge.data.source),
        target: encodeId(edge.data.target),
      },
    })),
  };
}

/**
 * Parses a node ID string.
 * Returns an object with name, filePath, and line.
 */
function parseNodeId(id: string): { name: string; filePath: string; line: number } | null {
  try {
    const rawId = decodeURIComponent(id);

    const match = rawId.match(/^(.*?) @ (.*):(\d+)$/);

    if (!match) {
      console.error(`[Parse Error] ID format mismatch: ${rawId}`);
      return null;
    }

    const name = match[1];
    const filePath = match[2];
    const line = parseInt(match[3], 10);

    return { name, filePath, line };
  } catch (error) {
    console.error(`Error parsing node ID: ${id}`, error);
    return null;
  }
}

/**
 * Display a call graph in a webview panel.
 * Graph data is sent via postMessage (safe from injection, enables dynamic updates).
 */
export function showGraphView(
  context: vscode.ExtensionContext,
  graph: CytoscapeGraph,
  targetNodeId: string,
  output: vscode.OutputChannel,
  // Accept the analyzer function as a parameter
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

    const cssPath = vscode.Uri.joinPath(
      context.extensionUri,
      "dist",
      "templates",
      "graphStyle.css"
    );
    const scriptPath = vscode.Uri.joinPath(
      context.extensionUri,
      "dist",
      "templates",
      "graphScript.js"
    );

    const cssUri = panel.webview.asWebviewUri(cssPath);
    const scriptUri = panel.webview.asWebviewUri(scriptPath);

    htmlContent = htmlContent.replace("${cssUri}", cssUri.toString());
    htmlContent = htmlContent.replace("${scriptUri}", scriptUri.toString());

    panel.webview.html = htmlContent;

    // Send the initial graph data
    // This call now correctly encodes all raw IDs from `graph` exactly once.
    const encodedGraph = encodeGraphIds(graph);
    const encodedTargetId = encodeId(targetNodeId);

    panel.webview.postMessage({
      type: "INIT_GRAPH",
      data: encodedGraph,
      targetId: encodedTargetId,
    });

    // This will listen for messages *from* the graphScript.js
    panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "NODE_TAPPED":
            const tappedNodeId = message.payload.id; // This is a RAW ID from frontend
            output.appendLine(`[Webview] Node tapped (Raw): ${tappedNodeId}`);

            try {
              const parsed = parseNodeId(tappedNodeId);
              if (!parsed) {
                output.appendLine(`[Extension] ❌ Failed to parse ID: ${tappedNodeId}`);
                return;
              }

              const { name, filePath, line } = parsed;
              output.appendLine(`[Extension] Parsed: Name=${name}, File=${filePath}, Line=${line}`);

              if (!vscode.workspace.workspaceFolders?.[0]) {
                output.appendLine("[Extension] ❌ No workspace folder open.");
                return;
              }

              // Construct absolute path
              const fileUri = vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders[0].uri,
                filePath
              );
              output.appendLine(`[Extension] Resolving URI: ${fileUri.fsPath}`);

              // Try to open the document
              let doc: vscode.TextDocument;
              try {
                doc = await vscode.workspace.openTextDocument(fileUri);
              } catch (e) {
                output.appendLine(`[Extension] ❌ Could not open document: ${e}`);
                return;
              }

              // Calculate position (Note: line number needs -1 because VS Code is 0-indexed)
              // The previous toFuncCall used +1, so we subtract it back here
              const zeroBasedLine = Math.max(0, line - 1);
              const lineText = doc.lineAt(zeroBasedLine).text;

              // Try to find the exact character position of the function name on this line
              const characterIndex = lineText.indexOf(name);
              const safeCharacterIndex = characterIndex >= 0 ? characterIndex : 0;
              const pos = new vscode.Position(zeroBasedLine, safeCharacterIndex);

              output.appendLine(
                `[Extension] Analyzer Trigger: ${name} at ${filePath}:${line} (Char: ${safeCharacterIndex})`
              );

              // Call the analyzer
              const rawHierarchy = await getCallHierarchyAt(doc, pos);

              if (!rawHierarchy) {
                output.appendLine("[Extension] ⚠️ Analyzer returned NO results.");
                return;
              }

              // 5. Convert to our internal type
              const internalHierarchy = convertVsCodeHierarchy(rawHierarchy);

              // 6. Transform to Cytoscape format (generates RAW IDs)
              const hierarchyGraph = transformToCytoscapeGraph(internalHierarchy);

              // 7. [NEW] Filter out nodes that were already sent in the initial graph
              //    (We keep the webview's de-duplication for nodes added by *other* expansions)
              const initialNodeIds = new Set(graph.nodes.map((n) => n.data.id));

              const newNodes = hierarchyGraph.nodes.filter(
                (node) => !initialNodeIds.has(node.data.id)
              );

              // We only send edges that connect to these new nodes, or edges
              // that were not in the initial graph (like recursive calls)
              const initialEdgeIds = new Set(graph.edges.map((e) => e.data.id!));

              const newEdges = hierarchyGraph.edges.filter(
                (edge) => !initialEdgeIds.has(edge.data.id!)
              );

              // 8. Create the graph of *only* new elements
              const newGraphData = {
                nodes: newNodes,
                edges: newEdges,
              };

              // 9. Encode all RAW IDs for safe transport
              const newEncodedGraph = encodeGraphIds(newGraphData);

              output.appendLine(
                `[Extension] Sending new elements: ${JSON.stringify(newEncodedGraph, null, 2)}`
              );

              // 8. Send the new, consistently-encoded elements to the webview
              panel.webview.postMessage({
                type: "ADD_ELEMENTS",
                data: newEncodedGraph,
              });
            } catch (error) {
              const msg = `[Extension] Error expanding node: ${error}`;
              output.appendLine(msg);
              vscode.window.showErrorMessage(msg);
            }
            return;
        }
      },
      undefined,
      context.subscriptions
    );
  } catch (error) {
    const msg = `Failed to show graph: ${error}`;
    output.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}
