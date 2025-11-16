import * as vscode from "vscode";
// Import the REAL analyzer functions
import { getCallHierarchyAt, customProvider, analyzeCallHierarchy } from "@/analyzer";
// Import graph functions, including the new converter helpers
import {
  showGraphView,
  transformToCytoscapeGraph,
  convertVsCodeHierarchy,
  toFuncCall, // We'll use this for the debug command
} from "@/graph";
import { getGitHubSession } from "@/license";
// Import CallHierarchy type for the mock data
import type { CallHierarchy, FunctionCall } from "@/types";

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("ThoughtFlow");
  context.subscriptions.push(output);

  // Register the provider *once* on activation
  // This is required for `getCallHierarchyAt` to function
  context.subscriptions.push(
    vscode.languages.registerCallHierarchyProvider(
      { scheme: "file", language: "python" },
      customProvider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.visualizeCallGraph", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a Python file and place cursor on a function.");
        return;
      }

      // --- This is the fully implemented production flow ---
      try {
        output.appendLine("Running command: visualizeCallGraph...");

        // 1. Get REAL data from analyzer
        const rawHierarchy = await getCallHierarchyAt(editor.document, editor.selection.active);

        if (!rawHierarchy) {
          vscode.window.showInformationMessage("No call hierarchy found at this position.");
          output.appendLine("Analyzer returned no hierarchy.");
          return;
        }

        // 2. Convert VS Code types -> internal types
        // This is the first step of the "transformer" part
        const hierarchy = convertVsCodeHierarchy(rawHierarchy);

        // 3. Create the unique ID for the target node
        const targetId = `${hierarchy.target.name} @ ${hierarchy.target.filePath}:${hierarchy.target.line}`;
        output.appendLine(`[Extension] Target ID: ${targetId}`);

        // 4. Transform internal types -> Cytoscape data
        // This is the second step of the "transformer" part
        const graphData = transformToCytoscapeGraph(hierarchy);
        output.appendLine(`[Extension] Initial graph: ${JSON.stringify(graphData, null, 2)}`);

        // 5. Show the UI and pass the analyzer function for expansion
        showGraphView(context, graphData, targetId, output, getCallHierarchyAt);
      } catch (error) {
        const msg = `Error visualizing call graph: ${error}`;
        output.appendLine(`[ERROR] ${msg}`);
        vscode.window.showErrorMessage(msg);
      }
    })
  );

  // --- DEBUG COMMANDS ---

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testAnalyzer", async () => {
      output.appendLine("Testing call hierarchy analyzer (debug)...");
      // This command runs the analyzer and saves to JSON, good for debugging
      analyzeCallHierarchy(context, output);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testGraph", async () => {
      output.appendLine("Testing graph transformation and visualization (debug)...");

      // This command intentionally uses MOCK data to test the UI in isolation.
      // This mock data is now CORRECTED to match 'test-workspace/'
      const mockHierarchy: CallHierarchy = {
        target: {
          name: "main",
          filePath: "main.py",
          line: 5, // Correct line for 'def main' in main.py
        },
        incoming: [
          // This represents the `if __name__ == "__main__":` block
          { name: "module_call", filePath: "main.py", line: 11 }, // Correct line for 'main()' call
        ],
        outgoing: [
          // Correct path and line for 'def add' in calculator/utils.py
          { name: "add", filePath: "calculator/utils.py", line: 1 },
          // Correct path and line for 'def factorial' in calculator/core.py
          { name: "factorial", filePath: "calculator/core.py", line: 5 },
        ],
      };

      // Calculate the targetNodeId from the mock data
      const targetId = `${mockHierarchy.target.name} @ ${mockHierarchy.target.filePath}:${mockHierarchy.target.line}`;

      // Call your Transformation function
      const transformedGraph = transformToCytoscapeGraph(mockHierarchy);

      output.appendLine(`[Debug] Target ID: ${targetId}`);
      output.appendLine(`[Debug] Transformed Graph: ${JSON.stringify(transformedGraph, null, 2)}`);

      // Call showGraphView, passing the real analyzer function
      // This allows the mock graph to be expandable using real data.
      showGraphView(context, transformedGraph, targetId, output, getCallHierarchyAt);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testGitHubAuth", async () => {
      output.appendLine("Testing GitHub Authentication...");

      const session = await getGitHubSession();

      if (session) {
        output.appendLine(`✅ GitHub User ID: ${session.account.id}`); // GitHub numeric ID
        output.appendLine(`✅ GitHub User Name: ${session.account.label}`); // GitHub username
      } else {
        output.appendLine("❌ Failed to get GitHub session");
      }

      output.show();
    })
  );
}

export function deactivate() {}
