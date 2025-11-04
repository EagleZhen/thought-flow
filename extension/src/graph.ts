import * as vscode from 'vscode';
import * as fs from 'fs';
import type { CytoscapeGraph } from '@/types';

// Encode ID for safe use in HTML/CSS (reversible with decodeURIComponent)
const encodeId = (id: string) => encodeURIComponent(id);

/**
 * Encode all IDs in graph for safe HTML/CSS use.
 */
function encodeGraphIds(graph: CytoscapeGraph): CytoscapeGraph {
  return {
    nodes: graph.nodes.map(node => ({
      data: {
        id: encodeId(node.data.id),
        label: node.data.label
      }
    })),
    edges: graph.edges.map(edge => ({
      data: {
        source: encodeId(edge.data.source),
        target: encodeId(edge.data.target)
      }
    }))
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
    'thoughtflowGraph',
    'ThoughtFlow - Call Graph',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'templates')]
    }
  );

  try {
    const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'templates', 'graphView.html');
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

    const cssPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'templates', 'graphStyle.css');
    const scriptPath = vscode.Uri.joinPath(context.extensionUri, 'dist', 'templates', 'graphScript.js');

    const cssUri = panel.webview.asWebviewUri(cssPath);
    const scriptUri = panel.webview.asWebviewUri(scriptPath);

    htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
    htmlContent = htmlContent.replace('${scriptUri}', scriptUri.toString());

    panel.webview.html = htmlContent;

    // Encode IDs and send via postMessage
    const encodedGraph = encodeGraphIds(graph);
    panel.webview.postMessage({ type: 'INIT_GRAPH', data: encodedGraph });

    output.appendLine('Original graph:');
    output.appendLine(JSON.stringify(graph, null, 2));
    output.appendLine('Encoded graph (IDs safe for HTML/CSS):');
    output.appendLine(JSON.stringify(encodedGraph, null, 2));
  } catch (error) {
    const msg = `Failed to show graph: ${error}`;
    output.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}
