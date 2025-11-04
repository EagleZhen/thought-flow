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
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'webview')]
    }
  );

  try {
    const graphDataJson = JSON.stringify(graph);
    output.appendLine('Graph data: ' + graphDataJson);

    const htmlPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'graphView.html');
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

    const cssPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'graphStyle.css');
    const scriptPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'graphScript.js');

    const cssUri = panel.webview.asWebviewUri(cssPath);
    const scriptUri = panel.webview.asWebviewUri(scriptPath);

    htmlContent = htmlContent.replace('${graphDataJson}', graphDataJson);
    htmlContent = htmlContent.replace('${cssUri}', cssUri.toString());
    htmlContent = htmlContent.replace('${scriptUri}', scriptUri.toString());

    panel.webview.html = htmlContent;
  } catch (error) {
    const msg = `Failed to show graph: ${error}`;
    output.appendLine(`[ERROR] ${msg}`);
    vscode.window.showErrorMessage(msg);
  }
}
