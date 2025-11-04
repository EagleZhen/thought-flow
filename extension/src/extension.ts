import * as vscode from "vscode";
import { showGraphView } from "@/graph";
import { getGitHubSession } from "@/license";
import type { CytoscapeGraph } from "@/types";

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
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testAnalyzer", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a Python file and place cursor on a function.");
        return;
      }

      // TODO: Test analyzer, log to output channel
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testGraph", async () => {
      output.appendLine("Testing graph visualization...");

      // Stub data for testing
      const stubGraph: CytoscapeGraph = {
        nodes: [
          { data: { id: "main @ main.py:1", label: "main" } },
          { data: { id: "add @ utils.py:5", label: "add" } },
          { data: { id: "path/factorial @ core.py:10", label: "path/factorial" } },
        ],
        edges: [
          { data: { source: "main @ main.py:1", target: "add @ utils.py:5" } },
          { data: { source: "main @ main.py:1", target: "path/factorial @ core.py:10" } },
        ],
      };

      showGraphView(context, stubGraph, output);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testGitHubAuth", async () => {
      output.appendLine("Testing GitHub Authentication...");

      const session = await getGitHubSession();

      if (session) {
        output.appendLine(`✅ GitHub User ID: ${session.userId}`);
        output.appendLine(`✅ GitHub User Name: ${session.userName}`);
      } else {
        output.appendLine("❌ Failed to get GitHub session");
      }

      output.show();
    })
  );
}

export function deactivate() {}
