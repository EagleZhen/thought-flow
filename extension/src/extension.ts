import * as vscode from "vscode";

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
      // TODO: Test graph with stub data
    })
  );
}

export function deactivate() {}
