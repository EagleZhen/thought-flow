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
exports.getCallHierarchy = getCallHierarchy;
exports.activate = activate;
exports.deactivate = deactivate;
// Import the VS Code extension API under the alias `vscode` so we can
// access editor/commands/workspace types and functions.
const vscode = __importStar(require("vscode"));
/**
 * Helper: call built-in call hierarchy commands
 *
 * Given a document + position, this function uses VS Code's built-in call
 * hierarchy commands to prepare the symbol at the cursor and then fetches both
 * incoming (who calls me) and outgoing (who I call) relationships.
 */
async function getCallHierarchy(document, position) {
    try {
        // Log to the developer console for debugging; helpful when running the
        // extension in the Extension Host.
        console.log('🔍 Preparing call hierarchy...');
        // Ask VS Code to "prepare" the call hierarchy at a document location.
        // This returns one or more CallHierarchyItems (we'll use the first).
        const hierarchy = await vscode.commands.executeCommand('vscode.prepareCallHierarchy', document.uri, position);
        console.log(`📋 Hierarchy items found: ${hierarchy?.length || 0}`);
        if (!hierarchy || hierarchy.length === 0) {
            console.log('❌ No hierarchy items found');
            return null;
        }
        // The symbol at the cursor (function/class/method etc.).
        const item = hierarchy[0];
        console.log(`🎯 Working with symbol: ${item.name}`);
        console.log('📞 Getting incoming calls...');
        // Who calls this symbol?
        const incomingCalls = await vscode.commands.executeCommand('vscode.provideIncomingCalls', item);
        console.log(`📞 Incoming calls found: ${incomingCalls?.length || 0}`);
        console.log('📤 Getting outgoing calls...');
        // Which symbols does this one call?
        const outgoingCalls = await vscode.commands.executeCommand('vscode.provideOutgoingCalls', item);
        console.log(`📤 Outgoing calls found: ${outgoingCalls?.length || 0}`);
        // Return a small object with the base symbol and the two edge lists.
        return {
            function: item,
            callers: incomingCalls || [],
            callees: outgoingCalls || []
        };
    }
    catch (error) {
        console.error('❌ Error in getCallHierarchy:', error);
        throw error;
    }
}
/** Utility: escape RegExp special chars (Just a safety function)
 * When building regex from user text (like a function name), we must escape
 * regex meta characters so our search remains literal.
 */
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Simple custom CallHierarchyProvider
 *
 * This provider is a basic example that:
 * - Treats the word under the cursor as a function symbol.
 * - Scans all .ts/.js files for incoming calls using a regex.
 * - Scans the current file's function body for outgoing calls using a regex.
 *
 * It does not do full semantic analysis; it's intentionally lightweight.
 */
const customProvider = {
    async prepareCallHierarchy(document, position, token) {
        // Find the word at the cursor (the candidate function name).
        const range = document.getWordRangeAtPosition(position);
        if (!range) {
            // If there isn't a word, we can't prepare a symbol.
            return undefined;
        }
        // Get the selected name and construct a CallHierarchyItem at that range.
        const name = document.getText(range);
        const item = new vscode.CallHierarchyItem(vscode.SymbolKind.Function, name, '', document.uri, range, range);
        return item;
    },
    async provideCallHierarchyIncomingCalls(item, token) {
        // We'll collect all locations where `item.name` is called.
        const results = [];
        const name = item.name;
        // Search all TypeScript/JavaScript/Python files in the workspace (excluding node_modules).
        const files = await vscode.workspace.findFiles('**/*.{ts,js,py}', '**/node_modules/**');
        for (const uri of files) {
            // Read each file's text and search for "name(" occurrences.
            const doc = await vscode.workspace.openTextDocument(uri);
            const text = doc.getText();
            // Build a regex for a word boundary + function name + optional spaces + '('.
            const regex = new RegExp('\\b' + escapeRegExp(name) + '\\s*\\(', 'g');
            let m;
            while ((m = regex.exec(text)) !== null) {
                // Map the match index to a position and then to a range for the name.
                const start = doc.positionAt(m.index);
                const wordRange = doc.getWordRangeAtPosition(start) ??
                    new vscode.Range(start, start.translate(0, name.length));
                // Create a CallHierarchyItem representing the caller at this location.
                const fromItem = new vscode.CallHierarchyItem(vscode.SymbolKind.Function, doc.getText(wordRange), '', uri, wordRange, wordRange);
                // Record one incoming call with the range where it's referenced.
                results.push(new vscode.CallHierarchyIncomingCall(fromItem, [wordRange]));
            }
        }
        // Return all discovered incoming call sites.
        return results;
    },
    async provideCallHierarchyOutgoingCalls(item, token) {
        // We'll scan the body of the symbol at `item` for call-like tokens.
        const results = [];
        const doc = await vscode.workspace.openTextDocument(item.uri);
        const text = doc.getText();
        // Depending on language, extract function body region differently.
        let bodyStartOffset = -1;
        let bodyEndOffset = -1;
        if (doc.languageId === 'python') {
            // Python: determine function body by indentation.
            const defLine = item.selectionRange.start.line;
            const total = doc.lineCount;
            const defIndent = doc.lineAt(defLine).firstNonWhitespaceCharacterIndex;
            // Find first non-empty body line after the def line.
            let firstBodyLine = defLine + 1;
            while (firstBodyLine < total && doc.lineAt(firstBodyLine).text.trim().length === 0) {
                firstBodyLine++;
            }
            if (firstBodyLine >= total) {
                return results; // no body
            }
            const bodyIndent = doc.lineAt(firstBodyLine).firstNonWhitespaceCharacterIndex;
            if (bodyIndent <= defIndent) {
                return results; // not a proper indented block
            }
            // Body starts at the first non-empty line.
            const bodyStartPos = new vscode.Position(firstBodyLine, 0);
            bodyStartOffset = doc.offsetAt(bodyStartPos);
            // Walk forward until a non-empty line dedents below bodyIndent.
            let endLine = firstBodyLine;
            for (let ln = firstBodyLine; ln < total; ln++) {
                const lineText = doc.lineAt(ln).text;
                if (lineText.trim().length === 0) {
                    endLine = ln; // allow blank lines inside the block
                    continue;
                }
                const indent = doc.lineAt(ln).firstNonWhitespaceCharacterIndex;
                if (indent < bodyIndent) {
                    break; // dedented: block ended before this line
                }
                endLine = ln;
            }
            const bodyEndPos = doc.lineAt(endLine).range.end;
            bodyEndOffset = doc.offsetAt(bodyEndPos);
        }
        else {
            // Languages with braces (TypeScript/JavaScript): find body by matching braces.
            const searchStart = doc.offsetAt(item.selectionRange.end);
            let braceIndex = text.indexOf('{', searchStart);
            if (braceIndex === -1) {
                return results; // no body found
            }
            let depth = 0;
            let endIndex = -1;
            for (let i = braceIndex; i < text.length; i++) {
                if (text[i] === '{') {
                    depth++;
                }
                else if (text[i] === '}') {
                    depth--;
                    if (depth === 0) {
                        endIndex = i;
                        break;
                    }
                }
            }
            if (endIndex === -1) {
                endIndex = text.length;
            }
            bodyStartOffset = braceIndex + 1;
            bodyEndOffset = endIndex;
        }
        if (bodyStartOffset < 0 || bodyEndOffset < 0 || bodyEndOffset <= bodyStartOffset) {
            return results;
        }
        const body = text.substring(bodyStartOffset, bodyEndOffset);
        // A simplistic call pattern: identifier followed by '(' (e.g., foo()).
        const callRegex = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
        let m;
        while ((m = callRegex.exec(body)) !== null) {
            const calledName = m[1];
            if (calledName === item.name) {
                continue; // ignore self call
            }
            const absIndex = bodyStartOffset + m.index;
            const start = doc.positionAt(absIndex);
            const wordRange = doc.getWordRangeAtPosition(start) ??
                new vscode.Range(start, start.translate(0, calledName.length));
            const toItem = new vscode.CallHierarchyItem(vscode.SymbolKind.Function, calledName, '', item.uri, wordRange, wordRange);
            results.push(new vscode.CallHierarchyOutgoingCall(toItem, [wordRange]));
        }
        return results;
    }
};
/**
 * ACTIVATE — main entry
 */
function activate(context) {
    // Create an Output Channel to display logs for this extension.
    const output = vscode.window.createOutputChannel('Call Hierarchy Debug');
    // Immediately reveal the Output Channel so users can see progress.
    output.show(true);
    // Register our custom Call Hierarchy provider for TypeScript and Python files.
    context.subscriptions.push(vscode.languages.registerCallHierarchyProvider({ scheme: 'file', language: 'typescript' }, customProvider));
    context.subscriptions.push(vscode.languages.registerCallHierarchyProvider({ scheme: 'file', language: 'python' }, customProvider));
    // Register the command that triggers the analysis and JSON export.
    const disposable = vscode.commands.registerCommand('callHierarchyDemo.showCallHierarchy', async () => {
        try {
            console.log('🚀 Command started - Show Call Hierarchy');
            output.appendLine('🚀 Command started - Show Call Hierarchy');
            // Ensure there is an active editor with a file open.
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                const msg = 'Open a TypeScript file and put the cursor on a function name first.';
                console.log('❌ ' + msg);
                output.appendLine('❌ ' + msg);
                vscode.window.showInformationMessage(msg);
                return;
            }
            // Log some context about where we're analyzing from.
            console.log(`📄 Active file: ${editor.document.fileName}`);
            console.log(`📍 Cursor position: ${editor.selection.active.line}:${editor.selection.active.character}`);
            output.appendLine(`📄 Active file: ${editor.document.fileName}`);
            output.appendLine(`📍 Cursor position: ${editor.selection.active.line}:${editor.selection.active.character}`);
            // Notify the user via a toast message as well.
            vscode.window.showInformationMessage('Analyzing call hierarchy...');
            // Build the call hierarchy graph for the symbol under the cursor.
            const result = await getCallHierarchy(editor.document, editor.selection.active);
            if (!result) {
                const msg = 'No symbol or no provider found at the current position.';
                console.log('❌ ' + msg);
                output.appendLine('❌ ' + msg);
                vscode.window.showInformationMessage(msg);
                return;
            }
            console.log('✅ Call hierarchy data retrieved successfully');
            output.appendLine('✅ Call hierarchy data retrieved successfully');
            // Assemble a minimal JSON shape with the symbol and edge lists.
            // Convert file URIs to workspace-relative paths for portability.
            const toRel = (uri) => vscode.workspace.asRelativePath(uri, false);
            const data = {
                function: result.function.name,
                uri: toRel(result.function.uri),
                line: result.function.range.start.line + 1,
                incoming: result.callers?.map(c => ({
                    from: c.from.name,
                    uri: toRel(c.from.uri),
                    line: c.fromRanges[0].start.line + 1
                })) || [],
                outgoing: result.callees?.map(c => ({
                    to: c.to.name,
                    uri: toRel(c.to.uri),
                    line: c.fromRanges[0].start.line + 1
                })) || []
            };
            console.log('📊 Generated data:', data);
            output.appendLine('📊 Generated data:');
            output.appendLine(JSON.stringify(data, null, 2));
            // write to file
            // We save to ".vscode/callHierarchy.json" in the first workspace folder.
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders && workspaceFolders.length > 0) {
                try {
                    // Ensure the ".vscode" directory exists.
                    const dirUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode');
                    console.log(`📁 Creating directory: ${dirUri.fsPath}`);
                    output.appendLine(`📁 Creating directory: ${dirUri.fsPath}`);
                    await vscode.workspace.fs.createDirectory(dirUri);
                    // Create a file URI for the JSON and write the content.
                    const fileUri = vscode.Uri.joinPath(dirUri, 'callHierarchy.json');
                    console.log(`💾 Writing file: ${fileUri.fsPath}`);
                    output.appendLine(`💾 Writing file: ${fileUri.fsPath}`);
                    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(data, null, 2)));
                    const successMsg = `✅ Call hierarchy saved to ${fileUri.fsPath}`;
                    console.log(successMsg);
                    output.appendLine(successMsg);
                    vscode.window.showInformationMessage(successMsg);
                    // Open the generated file
                    const doc = await vscode.workspace.openTextDocument(fileUri);
                    await vscode.window.showTextDocument(doc);
                }
                catch (fileError) {
                    // Handle any filesystem errors and surface them to the user.
                    const errorMsg = `❌ Error writing file: ${fileError}`;
                    console.error(errorMsg);
                    output.appendLine(errorMsg);
                    vscode.window.showErrorMessage(errorMsg);
                }
            }
            else {
                // Without a workspace folder, we don't have a place to save the file.
                const warningMsg = '⚠️ No workspace folder open — cannot save callHierarchy.json.';
                console.log(warningMsg);
                output.appendLine(warningMsg);
                vscode.window.showWarningMessage(warningMsg);
            }
            // log to Output
            // Final delimiter in the output channel to mark completion.
            output.appendLine('--- Call Hierarchy Analysis Complete ---');
            output.show(true);
        }
        catch (error) {
            // Catch any unexpected errors from the overall command handler.
            const errorMsg = `❌ Unexpected error: ${error}`;
            console.error(errorMsg);
            output.appendLine(errorMsg);
            vscode.window.showErrorMessage(errorMsg);
        }
    });
    // Ensure the command is disposed when the extension is deactivated.
    context.subscriptions.push(disposable);
}
// This extension doesn't need to perform any teardown work.
function deactivate() { }
//# sourceMappingURL=extension.js.map