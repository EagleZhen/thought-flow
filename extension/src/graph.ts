import * as vscode from "vscode";
import * as fs from "fs";
import { CallHierarchy, FunctionCall, CytoscapeGraph, CytoscapeNode, CytoscapeEdge } from "./types";

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
 * Display a call graph in a webview panel.
 * Graph data is sent via postMessage (safe from injection, enables dynamic updates).
 */
export function showGraphView(
  context: vscode.ExtensionContext,
  graph: CytoscapeGraph,
  output: vscode.OutputChannel
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

    // Encode IDs and send via postMessage
    const encodedGraph = encodeGraphIds(graph);
    panel.webview.postMessage({ type: "INIT_GRAPH", data: encodedGraph });

    output.appendLine("Original graph:");
    output.appendLine(JSON.stringify(graph, null, 2));
    output.appendLine("Encoded graph (IDs safe for HTML/CSS):");
    output.appendLine(JSON.stringify(encodedGraph, null, 2));
  } catch (error) {
    const msg = `Failed to show graph: ${error}`;
    output.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}

/**
 * Transforms the backend CallHierarchy data into a Cytoscape.js compatible graph format.
 * * @param hierarchy The raw call hierarchy data from the analyzer.
 * @returns A CytoscapeGraph object (nodes and edges) ready for visualization.
 */
export function transformToCytoscapeGraph(hierarchy: CallHierarchy): CytoscapeGraph {
  const nodes: CytoscapeNode[] = [];
  const edges: CytoscapeEdge[] = [];

  // Use a Set to prevent duplicate nodes.
  // A function can be called multiple times, but should only appear as one node.
  const addedNodeIds = new Set<string>();

  /**
   * Helper function to generate a unique ID for a function call.
   * This ID is used by Cytoscape to connect edges.
   * Format: "functionName @ filePath:lineNumber"
   */
  const getUniqueId = (func: FunctionCall): string => {
    return `${func.name} @ ${func.filePath}:${func.line}`;
  };

  /**
   * Helper function to add a node to the graph if it hasn't been added yet.
   */
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

    // Add the caller node
    addNode(incomingFunc);

    // Add the edge from the caller to the target
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

    // Add the callee node
    addNode(outgoingFunc);

    // Add the edge from the target to the callee
    edges.push({
      data: {
        source: targetId,
        target: outgoingId,
      },
    });
  }

  return { nodes, edges };
}
