"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
// Import the VS Code extension API to access editor/commands/workspace types and functions.
const vscode = __importStar(require("vscode"));
const analyzer_1 = require("./analyzer");
/**
 * Extension activation - register provider and command.
 *
 * This function is called by VS Code when the extension is first activated.
 * Activation occurs when:
 * - The user runs one of the extension's commands
 * - An activation event specified in package.json is triggered
 *
 * We use this opportunity to:
 * 1. Create an output channel for logging
 * 2. Register our custom call hierarchy provider for Python files
 * 3. Register the command that analyzes and exports call hierarchy to JSON
 *
 * @param context - Extension context provided by VS Code
 *                  Used to register disposables (things that need cleanup when extension is deactivated)
 */
function activate(context) {
    // ============================================================
    // Create output channel for debugging and user feedback
    // ============================================================
    // An output channel is like a console/log panel in VS Code
    // Users can view it via: View > Output > "Call Hierarchy Debug"
    const output = vscode.window.createOutputChannel('Call Hierarchy Debug');
    output.show(true); // Show the panel immediately when extension activates
    // ============================================================
    // Register the custom call hierarchy provider for Python files
    // ============================================================
    // This tells VS Code: "When working with Python files, use our custom provider
    // to implement call hierarchy functionality"
    //
    // Selector: { scheme: 'file', language: 'python' }
    //   - scheme: 'file' = only local files (not remote/virtual files)
    //   - language: 'python' = only .py files
    context.subscriptions.push(vscode.languages.registerCallHierarchyProvider({ scheme: 'file', language: 'python' }, analyzer_1.customProvider));
    // ============================================================
    // Register the command: "Show Call Hierarchy"
    // ============================================================
    // This command is defined in package.json:
    //   - ID: 'callHierarchyDemo.showCallHierarchy'
    //   - Keyboard shortcut: Cmd/Ctrl+Shift+H
    //   - Context menu: Right-click in Python files
    context.subscriptions.push(vscode.commands.registerCommand('callHierarchyDemo.showCallHierarchy', async () => {
        try {
            output.appendLine('🚀 Command started');
            // ============================================================
            // STEP 1: Get the active editor
            // ============================================================
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                // No file is currently open in the editor
                vscode.window.showInformationMessage('Open a Python file and place cursor on a function.');
                return;
            }
            // ============================================================
            // STEP 2: Log context information
            // ============================================================
            output.appendLine(`📄 File: ${editor.document.fileName}`);
            output.appendLine(`📍 Position: ${editor.selection.active.line}:${editor.selection.active.character}`);
            // ============================================================
            // STEP 3: Get the call hierarchy for the symbol at cursor
            // ============================================================
            const result = await (0, analyzer_1.getCallHierarchy)(editor.document, editor.selection.active);
            if (!result) {
                // Cursor is not on a valid symbol (e.g., on whitespace or comment)
                vscode.window.showInformationMessage('No symbol found at current position.');
                return;
            }
            // ============================================================
            // STEP 4: Build JSON data structure with relative paths
            // ============================================================
            // Helper function: convert absolute file URIs to workspace-relative paths
            // Example: file:///Users/me/project/foo.py → foo.py (if project is workspace root)
            const toRel = (uri) => vscode.workspace.asRelativePath(uri, false);
            // Extract function information
            const funcName = result.function.name;
            const funcFile = toRel(result.function.uri);
            const funcLine = result.function.range.start.line + 1; // +1 for 1-indexed display
            // Create the data object with incoming and outgoing calls
            const data = {
                function: funcName, // Name of the analyzed function
                current_file: funcFile, // File where function is defined
                line: funcLine, // Line number (1-indexed)
                // Incoming calls - who calls this function
                // Self-references are already filtered in the provider
                incoming: result.callers?.map(caller => ({
                    from: caller.from.name, // Name of the calling function
                    caller_line: caller.from.range.start.line + 1, // Line where caller is defined
                    file_path: toRel(caller.from.uri), // File containing the caller
                    line: caller.fromRanges[0].start.line + 1 // Line where the call happens
                })) || [],
                // Outgoing calls - what functions does this function call
                outgoing: result.callees?.map(callee => ({
                    to: callee.to.name, // Name of the called function
                    file_path: toRel(callee.to.uri), // File containing the callee
                    line: callee.fromRanges[0].start.line + 1 // Line where the call happens
                })) || []
            };
            // ============================================================
            // STEP 5: Log the generated data to output channel
            // ============================================================
            output.appendLine('📊 Generated data:');
            output.appendLine(JSON.stringify(data, null, 2));
            // ============================================================
            // STEP 6: Save to .vscode/callHierarchy.json
            // ============================================================
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
                // Ensure .vscode directory exists
                const vscodeDir = vscode.Uri.joinPath(folders[0].uri, '.vscode');
                await vscode.workspace.fs.createDirectory(vscodeDir);
                // Write the JSON file
                const fileUri = vscode.Uri.joinPath(vscodeDir, 'callHierarchy.json');
                await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(data, null, 2)));
                // ============================================================
                // STEP 7: Notify user and open the file
                // ============================================================
                output.appendLine(`✅ Saved to ${fileUri.fsPath}`);
                vscode.window.showInformationMessage(`Call hierarchy saved to ${fileUri.fsPath}`);
                // Open the JSON file in the editor so user can see the results
                const jsonDoc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(jsonDoc);
            }
            else {
                // No workspace folder is open (user opened a single file, not a folder)
                vscode.window.showWarningMessage('No workspace folder open.');
            }
            output.appendLine('--- Complete ---');
        }
        catch (error) {
            // ============================================================
            // Handle any errors that occur during execution
            // ============================================================
            const msg = `Error: ${error}`;
            output.appendLine(msg);
            vscode.window.showErrorMessage(msg);
        }
    }));
}
/**
 * Extension deactivation.
 */
function deactivate() { }
//# sourceMappingURL=extension.js.map