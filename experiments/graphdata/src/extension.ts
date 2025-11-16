import * as vscode from "vscode";
import { analyzeCallHierarchy, customProvider, getCallHierarchyAt } from "@/analyzer";
// Import transformToCytoscapeGraph and the CallHierarchy type
import { showGraphView, transformToCytoscapeGraph } from "@/graph";
import { getGitHubSession } from "@/license";
import type { CytoscapeGraph, CallHierarchy } from "@/types"; // Import CallHierarchy

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("ThoughtFlow");
  context.subscriptions.push(output);

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.visualizeCallGraph", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a Python file and place cursor on a function.");
        return;
      }

      // TODO: Full flow (analyze + transform + visualize)
      // 1. const rawHierarchy = await getCallHierarchyAt(editor.document, editor.selection.active);
      // 2. if (rawHierarchy) {
      // 3.   // Note: The getUniqueId logic is defined in graph.ts, so we replicate it here.
      // 4.   const toRel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);
      // 5.   const toFuncCall = (item: vscode.CallHierarchyItem): FunctionCall => ({
      // 6.     name: item.name,
      // 7.     filePath: toRel(item.uri),
      // 8.     line: item.range.start.line + 1, // Convert 0-indexed to 1-indexed
      // 9.   });
      // 10.
      // 11.  const hierarchy: CallHierarchy = {
      // 12.    target: toFuncCall(rawHierarchy.function),
      // 13.    incoming: rawHierarchy.callers.map((c: any) => toFuncCall(c.from)),
      // 14.    outgoing: rawHierarchy.callees.map((c: any) => toFuncCall(c.to)),
      // 15.  };
      // 16.
      // 17.  const targetId = `${hierarchy.target.name} @ ${hierarchy.target.filePath}:${hierarchy.target.line}`;
      // 18.  const graphData = transformToCytoscapeGraph(hierarchy);
      // 19.  showGraphView(context, graphData, targetId, output, getCallHierarchyAt);
      // 20. }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testAnalyzer", async () => {
      output.appendLine("Testing call hierarchy analyzer...");
      context.subscriptions.push(
        vscode.languages.registerCallHierarchyProvider(
          { scheme: "file", language: "python" },
          customProvider
        )
      );

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a Python file and place cursor on a function.");
        return;
      }
      // Call the analyzer function
      analyzeCallHierarchy(context, output);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testGraph", async () => {
      output.appendLine("Testing graph transformation and visualization...");

      // Step 1: Create Mock Analyzer Data (CallHierarchy)
      // This data now uses the CORRECT line numbers from test-workspace
      const mockHierarchy: CallHierarchy = {
        target: {
          name: "main",
          filePath: "main.py",
          line: 5, // Correct line for 'def main'
        },
        incoming: [
          // This node is simulated, its line number doesn't matter for this test
          { name: "module_call", filePath: "main.py", line: 10 },
        ],
        outgoing: [
          // Correct path and line for 'def add'
          { name: "add", filePath: "calculator/utils.py", line: 1 },
          // Correct path and line for 'def factorial'
          { name: "factorial", filePath: "calculator/core.py", line: 5 },
        ],
      };

      // Step 2: Calculate the targetNodeId from the mock data
      const targetId = `${mockHierarchy.target.name} @ ${mockHierarchy.target.filePath}:${mockHierarchy.target.line}`;

      // Step 3: Call your Transformation function
      const transformedGraph: CytoscapeGraph = transformToCytoscapeGraph(mockHierarchy);

      output.appendLine(`[Debug] Target ID: ${targetId}`);
      output.appendLine(`[Debug] Transformed Graph: ${JSON.stringify(transformedGraph, null, 2)}`);

      // Step 4: Call showGraphView, passing the analyzer function as an argument
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

  // The testDatabase command remains commented out
  // context.subscriptions.push(
  //   vscode.commands.registerCommand("thoughtflow.debug.testDatabase", async () => {
  //     ...
  //   })
  // );
}

export function deactivate() {}
