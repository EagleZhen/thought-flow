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
 * Helper to convert a VS Code CallHierarchyItem into our internal FunctionCall type.
 * @param item The VS Code CallHierarchyItem.
 * @param range The specific range of the call (optional, defaults to item's main range).
 */
export function toFuncCall(item: vscode.CallHierarchyItem, range?: vscode.Range): FunctionCall {
  const line = (range || item.range).start.line + 1; // Convert 0-indexed to 1-indexed
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
    incoming: rawHierarchy.callers.map((c) => toFuncCall(c.from, c.fromRanges[0])),
    outgoing: rawHierarchy.callees.map((c) => toFuncCall(c.to, c.fromRanges[0])),
  };
}

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
    edges.push({
      data: {
        source: incomingId,
        target: targetId,
      },
    });
  }

  // 3. Process outgoing calls (callees)
  // Edge direction: [Target] ---> [Callee]
  for (const outgoingFunc of hierarchy.outgoing) {
    const outgoingId = getUniqueId(outgoingFunc);
    addNode(outgoingFunc); // Add the callee node
    edges.push({
      data: {
        source: targetId,
        target: outgoingId,
      },
    });
  }

  return { nodes, edges };
}

// Encode ID for safe use in HTML/CSS (reversible with decodeURIComponent)
const encodeId = (id: string) => encodeURIComponent(id);

/**
 * Encode all IDs in graph for safe HTML/CSS use.
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
        source: encodeId(edge.data.source),
        target: encodeId(edge.data.target),
      },
    })),
  };
}

/**
 * Parses a node ID string (e.g., "add @ utils.py:5") into its components.
 * @param id The unique node ID.
 * @returns An object with filePath and line, or null if parsing fails.
 */
function parseNodeId(id: string): { filePath: string; line: number } | null {
  try {
    // Example: "add @ utils.py:5"
    const parts = id.split(" @ "); // ["add", "utils.py:5"]
    if (parts.length < 2) return null;

    const location = parts[parts.length - 1]; // "utils.py:5"
    const lastColonIndex = location.lastIndexOf(":");
    if (lastColonIndex === -1) return null;

    const filePath = location.substring(0, lastColonIndex); // "utils.py"
    const line = parseInt(location.substring(lastColonIndex + 1), 10); // 5

    if (!filePath || isNaN(line)) return null;

    return { filePath, line };
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
            const tappedNodeId = message.payload.id;
            output.appendLine(`[Webview] Node tapped: ${tappedNodeId}`);

            // --- This is the new "expand" logic ---
            try {
              // 1. Parse the node ID to get file and line
              const parsed = parseNodeId(tappedNodeId);
              if (!parsed) {
                output.appendLine(`[Extension] Could not parse node ID: ${tappedNodeId}`);
                return;
              }

              const { filePath, line } = parsed;

              // 2. Get the file's URI and open the document
              // Note: Assumes file is in the first workspace folder.
              // A more robust solution would search all workspace folders.
              if (!vscode.workspace.workspaceFolders?.[0]) {
                output.appendLine("[Extension] No workspace folder open.");
                return;
              }
              const fileUri = vscode.Uri.joinPath(
                vscode.workspace.workspaceFolders[0].uri,
                filePath
              );
              const doc = await vscode.workspace.openTextDocument(fileUri);

              // 3. Create the position (line is 1-based, Position is 0-based)
              // We use line-1 and character 0. getCallHierarchyAt will find the symbol on that line.
              const pos = new vscode.Position(line - 1, 0);

              // 4. Call the REAL analyzer
              output.appendLine(`[Extension] Analyzing: ${filePath} at line ${line}`);
              const rawHierarchy = await getCallHierarchyAt(doc, pos);

              if (!rawHierarchy) {
                output.appendLine("[Extension] Analyzer found no hierarchy for this node.");
                return;
              }

              // 5. Convert to our internal type
              const internalHierarchy = convertVsCodeHierarchy(rawHierarchy);

              // 6. Transform to Cytoscape format
              const newGraph = transformToCytoscapeGraph(internalHierarchy);
              const newEncodedGraph = encodeGraphIds(newGraph);

              output.appendLine(
                `[Extension] Sending new elements: ${JSON.stringify(newEncodedGraph, null, 2)}`
              );

              // 7. Send the new elements to the webview
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
