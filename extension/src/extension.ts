import * as vscode from "vscode";
// Import the REAL analyzer functions
import { getCallHierarchyAt, customProvider, analyzeCallHierarchy } from "@/analyzer";
// Import graph functions, including the new converter helpers
import { showGraphView, transformToCytoscapeGraph, convertVsCodeHierarchy } from "@/graph";
import {
  getGitHubSession,
  getOrCreateAccount,
  applyLicense,
  initializeAccountState,
  getCurrentAccount,
  refreshAccountState,
  logout,
} from "@/license";
import type { CytoscapeGraph, CallHierarchy } from "@/types";

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("ThoughtFlow");
  context.subscriptions.push(output);

  // Initialize account state on activation
  initializeAccountState(context).catch((err) => {
    console.error("Failed to initialize account:", err);
  });

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

      // Check tier - restrict to paid users only
      let account = getCurrentAccount();
      if (!account) {
        vscode.window.showWarningMessage(
          "Please sign in with GitHub first. The extension will prompt you to authenticate."
        );
        // Try to trigger auth by getting session (it will prompt if needed)
        const session = await getGitHubSession();
        if (!session) {
          return; // User cancelled auth
        }
        // Initialize account after successful auth
        await initializeAccountState(context);
        // Get the updated account
        account = getCurrentAccount();
        if (!account) {
          return; // Failed to get account
        }
      }

      if (account.tier !== "paid") {
        const choice = await vscode.window.showWarningMessage(
          "ThoughtFlow requires a paid license to use the call graph visualization feature.",
          "Enter License Key"
        );
        if (choice === "Enter License Key") {
          await vscode.commands.executeCommand("thoughtflow.enterLicenseKey");

          // Re-check account after license application
          account = getCurrentAccount();
          if (!account || account.tier !== "paid") {
            // Still not paid tier (user cancelled, entered invalid key, or still free)
            return;
          }
          // If paid tier now, continue to visualization below
        } else {
          return; // User didn't choose to enter license
        }
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
      output.appendLine("Testing call hierarchy analyzer...");
      let analyzedResults: CallHierarchy | undefined;

      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("Open a Python file and place cursor on a function.");
        return;
      }

      analyzedResults = await analyzeCallHierarchy(context, output);
      output.appendLine("📊 Generated data:");
      output.appendLine(JSON.stringify(analyzedResults, null, 2));
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

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.debug.testDatabase", async () => {
      output.appendLine("Testing Database Integration...");

      const session = await getGitHubSession();
      if (!session) {
        output.appendLine("❌ Failed to get GitHub session");
        output.show();
        return;
      }

      output.appendLine(`Session: ${session.account.id} (${session.account.label})`);
      const account = await getOrCreateAccount(session);
      if (!account) {
        output.appendLine("❌ Failed to get account from backend");
        output.show();
        return;
      }

      output.appendLine(`✅ Login: ${account.login}`);
      output.appendLine(`✅ Tier: ${account.tier}`);
      if (account.licenseKey) {
        output.appendLine(`✅ License: ${account.licenseKey}`);
        if (account.licenseExpiresAt) {
          output.appendLine(`✅ Expires: ${account.licenseExpiresAt.toDateString()}`);
        }
      }
      output.show();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.enterLicenseKey", async () => {
      const session = await getGitHubSession();
      if (!session) {
        vscode.window.showErrorMessage("Please sign in with GitHub first");
        return;
      }

      const licenseKey = await vscode.window.showInputBox({
        prompt: "Enter your license key",
        placeHolder: "AAAA-BBBB-CCCC-DDDD",
        validateInput: (value) => {
          const normalized = value.trim().toUpperCase();
          if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(normalized)) {
            return "Invalid format. Expected: AAAA-BBBB-CCCC-DDDD";
          }
          return null;
        },
      });

      if (!licenseKey) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Applying license key...",
          cancellable: false,
        },
        async () => {
          const result = await applyLicense(session, licenseKey);
          if (result.success) {
            // Refresh account state to update cached tier
            await refreshAccountState(context);

            const expiresMsg = result.expiresAt
              ? ` (expires ${result.expiresAt.toDateString()})`
              : "";
            const accessMsg = result.tier === "paid" ? "You can now use all features!" : "";
            vscode.window.showInformationMessage(
              `✅ License applied! Tier: ${result.tier}${expiresMsg}. ${accessMsg}`
            );
          } else {
            vscode.window.showErrorMessage(`❌ ${result.error}`);
          }
        }
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.showAccountInfo", async () => {
      const account = getCurrentAccount();

      if (!account) {
        vscode.window.showInformationMessage(
          "Not signed in. Run 'ThoughtFlow: Visualize Call Graph' to sign in with GitHub."
        );
        return;
      }

      // Build info message
      let message = `Account: ${account.login}\nTier: ${account.tier}`;
      if (account.licenseKey) {
        message += `\nLicense: ${account.licenseKey}`;
        if (account.licenseExpiresAt) {
          message += `\nExpires: ${account.licenseExpiresAt.toDateString()}`;
        }
      }

      vscode.window.showInformationMessage(message, { modal: true });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("thoughtflow.logout", async () => {
      const account = getCurrentAccount();

      if (!account) {
        vscode.window.showInformationMessage("You are not signed in.");
        return;
      }

      const choice = await vscode.window.showWarningMessage(
        `Log out from ${account.login}?`,
        "Log Out",
        "Cancel"
      );

      if (choice === "Log Out") {
        await logout(context);
        vscode.window.showInformationMessage("Successfully logged out.");
      }
    })
  );
}

export function deactivate() {}
