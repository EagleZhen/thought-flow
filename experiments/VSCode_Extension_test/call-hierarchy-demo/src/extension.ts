// Import the VS Code extension API to access editor/commands/workspace types and functions.
import * as vscode from 'vscode';

/**
 * Get call hierarchy for a symbol using the custom provider.
 * This function coordinates the entire call hierarchy analysis.
 */
async function getCallHierarchy(
    document: vscode.TextDocument,
    position: vscode.Position
) {
    try {
        // Create a cancellation token for async operations
        // Terminate the operation if
        // 1. the user triggers too many requests
        // 2. the operation takes too long
        const cts = new vscode.CancellationTokenSource();

        // Prepare call hierarchy - identify the symbol at cursor position
        const callHierarchy = await customProvider.prepareCallHierarchy(document, position, cts.token);
        const targetItem = Array.isArray(callHierarchy) ? callHierarchy[0] : callHierarchy;

        // Check if we found a valid symbol
        if (!targetItem) {
            cts.dispose();
            return null;
        }

        // Get incoming calls (who calls this function)
        const incomingCalls = await customProvider.provideCallHierarchyIncomingCalls(targetItem, cts.token);

        // Get outgoing calls (what functions this function calls)
        const outgoingCalls = await customProvider.provideCallHierarchyOutgoingCalls(targetItem, cts.token);

        // Clean up the cancellation token
        cts.dispose();

        // Return the complete call hierarchy data
        return {
            function: targetItem,
            callers: incomingCalls || [],
            callees: outgoingCalls || []
        };
    } catch (error) {
        console.error('Error in getCallHierarchy:', error);
        throw error;
    }
}

/**
 * Escape special regex characters for safe pattern construction.
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Custom Call Hierarchy Provider for Python files.
 */
const customProvider: vscode.CallHierarchyProvider = {
    /**
     * Identify the function symbol at the cursor position.
     * This function finds the nearest function definition enclosing the cursor.
     */
    async prepareCallHierarchy(
        document: vscode.TextDocument,
        position: vscode.Position,
    ) {
        // Step 1: Check if cursor is on a valid word/symbol
        // If cursor is on empty space, return undefined immediately
        const wordAtCursor = document.getWordRangeAtPosition(position);
        if (!wordAtCursor) {
            return undefined;
        }

        // Step 2: Get the word text at cursor position
        const wordText = document.getText(wordAtCursor);

        // Step 3: Define regex pattern to match Python function definitions (def function_name()
        const defPattern = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;

        // Step 4: Check if the cursor is directly on a function definition line
        const currentLineText = document.lineAt(position.line).text;
        const currentLineMatch = defPattern.exec(currentLineText);

        if (currentLineMatch && currentLineMatch[1] === wordText) {
            // Cursor is on the function name in a def line - use this function
            const startChar = currentLineText.indexOf(wordText);
            const nameRange = new vscode.Range(
                new vscode.Position(position.line, startChar),
                new vscode.Position(position.line, startChar + wordText.length)
            );
            return new vscode.CallHierarchyItem(
                vscode.SymbolKind.Function,
                wordText,
                '',
                document.uri,
                nameRange, // Full range of the item
                nameRange // Selection range (highlight just the function name)
            );
        }

        // Step 5: Otherwise, just use the word at cursor (for analyzing function calls, variables, etc.)
        return new vscode.CallHierarchyItem(
            vscode.SymbolKind.Function,
            wordText,
            '',
            document.uri,
            wordAtCursor,
            wordAtCursor
        );
    },

    /**
     * Find all incoming calls (callers) for the target function.
     * Searches all Python files to find where the target function is called.
     */
    async provideCallHierarchyIncomingCalls(
        item: vscode.CallHierarchyItem,
    ) {
        const results: vscode.CallHierarchyIncomingCall[] = [];
        const targetName = item.name;

        // Find all Python files in the workspace
        const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');

        // Process each Python file
        for (const fileUri of pythonFiles) {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const text = doc.getText();
            const lines = text.split(/\r?\n/);

            // Build a map of all function definitions in this file
            // This helps us identify which function contains each call site
            const defs: { name: string; start: number; end: number }[] = [];
            for (let i = 0; i < lines.length; i++) {
                const match = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(lines[i]);
                if (match) {
                    // Found a function definition - determine its boundaries
                    const indent = lines[i].search(/\S/);
                    let end = i + 1;
                    // Find the end of this function by checking indentation
                    while (end < lines.length) {
                        const line = lines[end];
                        if (line.trim() && line.search(/\S/) <= indent) break;
                        end++;
                    }
                    defs.push({ name: match[1], start: i, end: end - 1 });
                }
            }

            // Find all calls to the target function using regex
            const callRegex = new RegExp('\\b' + escapeRegExp(targetName) + '\\s*\\(', 'g');
            const defLinePattern = new RegExp('^\\s*def\\s+' + escapeRegExp(targetName) + '\\s*\\(');
            let match: RegExpExecArray | null;

            while ((match = callRegex.exec(text)) !== null) {
                const pos = doc.positionAt(match.index);
                const line = pos.line;

                // Skip if this is the function definition line itself (not a call)
                if (defLinePattern.test(lines[line] ?? '')) {
                    continue;
                }

                // Determine which function contains this call site
                let caller = '<module>'; // Default to module-level if not inside any function
                let callerDefLine = -1; // Track the line where the caller function is defined
                for (const def of defs) {
                    if (line > def.start && line <= def.end) {
                        caller = def.name;
                        callerDefLine = def.start;
                    }
                }

                // Skip if the caller is the same as the target (self-recursive call within the function)
                // This prevents showing the function calling itself in the incoming list
                if (caller === targetName) {
                    continue;
                }

                // Create a range for this call location
                const range = doc.getWordRangeAtPosition(pos) ??
                    new vscode.Range(pos, pos.translate(0, targetName.length));

                // Create a range for the caller's definition (or call site if <module>)
                const callerRange = callerDefLine >= 0
                    ? new vscode.Range(new vscode.Position(callerDefLine, 0), new vscode.Position(callerDefLine, 0))
                    : range;

                // Add this incoming call to the results
                results.push(new vscode.CallHierarchyIncomingCall(
                    new vscode.CallHierarchyItem(vscode.SymbolKind.Function, caller, '', fileUri, callerRange, callerRange),
                    [range]
                ));
            }
        }

        return results;
    },

    /**
     * Find all outgoing calls (callees) from the target function.
     * Scans the function body to find what other functions it calls.
     */
    async provideCallHierarchyOutgoingCalls(
        item: vscode.CallHierarchyItem,
    ) {
        const results: vscode.CallHierarchyOutgoingCall[] = [];
        const doc = await vscode.workspace.openTextDocument(item.uri);
        const text = doc.getText();

        // Locate the function definition line for the target function
        const defPattern = new RegExp('^\\s*def\\s+' + escapeRegExp(item.name) + '\\s*\\(');
        let defLine = item.selectionRange.start.line;

        // If current line is not the def line, search for it
        if (!defPattern.test(doc.lineAt(defLine).text)) {
            let found = false;
            // Search upwards from current position
            for (let ln = defLine; ln >= 0; ln--) {
                if (defPattern.test(doc.lineAt(ln).text)) {
                    defLine = ln;
                    found = true;
                    break;
                }
            }
            // If not found above, search the entire document
            if (!found) {
                for (let ln = 0; ln < doc.lineCount; ln++) {
                    if (defPattern.test(doc.lineAt(ln).text)) {
                        defLine = ln;
                        break;
                    }
                }
            }
        }

        // Determine function body boundaries using Python indentation
        const defIndent = doc.lineAt(defLine).firstNonWhitespaceCharacterIndex;
        let bodyStart = defLine + 1;

        // Skip blank lines after the function definition
        while (bodyStart < doc.lineCount && !doc.lineAt(bodyStart).text.trim()) {
            bodyStart++;
        }

        // Check if function body exists
        if (bodyStart >= doc.lineCount) {
            return results;
        }

        // Get the indentation level of the function body
        const bodyIndent = doc.lineAt(bodyStart).firstNonWhitespaceCharacterIndex;
        if (bodyIndent <= defIndent) {
            return results; // Not a proper indented block
        }

        // Find the end of the function body by checking indentation
        let bodyEnd = bodyStart;
        for (let ln = bodyStart; ln < doc.lineCount; ln++) {
            const lineText = doc.lineAt(ln).text;
            // Stop when we find a line with less indentation (function ended)
            if (lineText.trim() && doc.lineAt(ln).firstNonWhitespaceCharacterIndex < bodyIndent) {
                break;
            }
            bodyEnd = ln;
        }

        // Extract the function body text
        const bodyStartOffset = doc.offsetAt(new vscode.Position(bodyStart, 0));
        const bodyEndOffset = doc.offsetAt(doc.lineAt(bodyEnd).range.end);
        const bodyText = text.substring(bodyStartOffset, bodyEndOffset);

        // Search for all function calls within the body
        const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
        let match: RegExpExecArray | null;

        while ((match = callPattern.exec(bodyText)) !== null) {
            const callee = match[1];

            // Skip self-recursive calls (function calling itself)
            if (callee === item.name) {
                continue;
            }

            // Calculate the absolute position in the document
            const offset = bodyStartOffset + match.index;
            const pos = doc.positionAt(offset);
            const range = doc.getWordRangeAtPosition(pos) ??
                new vscode.Range(pos, pos.translate(0, callee.length));

            // Add this outgoing call to the results
            results.push(new vscode.CallHierarchyOutgoingCall(
                new vscode.CallHierarchyItem(vscode.SymbolKind.Function, callee, '', item.uri, range, range),
                [range]
            ));
        }

        return results;
    }
};

/**
 * Extension activation - register provider and command.
 * This is called when the extension is first activated.
 */
export function activate(context: vscode.ExtensionContext) {
    // Create an output channel for debugging and logging
    const output = vscode.window.createOutputChannel('Call Hierarchy Debug');
    output.show(true);

    // Register the custom call hierarchy provider for Python files
    context.subscriptions.push(
        vscode.languages.registerCallHierarchyProvider(
            { scheme: 'file', language: 'python' },
            customProvider
        )
    );

    // Register the command to analyze and export call hierarchy
    context.subscriptions.push(
        vscode.commands.registerCommand('callHierarchyDemo.showCallHierarchy', async () => {
            try {
                output.appendLine('🚀 Command started');

                // Get the active editor
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showInformationMessage('Open a Python file and place cursor on a function.');
                    return;
                }

                // Log the current file and cursor position
                output.appendLine(`📄 File: ${editor.document.fileName}`);
                output.appendLine(`📍 Position: ${editor.selection.active.line}:${editor.selection.active.character}`);

                // Get the call hierarchy for the symbol at cursor
                const result = await getCallHierarchy(editor.document, editor.selection.active);
                if (!result) {
                    vscode.window.showInformationMessage('No symbol found at current position.');
                    return;
                }

                // Build JSON data structure with relative paths
                const toRel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);
                const funcName = result.function.name;
                const funcFile = toRel(result.function.uri);
                const funcLine = result.function.range.start.line + 1;

                // Create the data object with incoming and outgoing calls
                const data = {
                    function: funcName,
                    current_file: funcFile,
                    line: funcLine,
                    // Incoming calls - self-references already filtered in provider
                    incoming: result.callers?.map(c => ({
                        from: c.from.name,
                        caller_line: c.from.range.start.line + 1,
                        file_path: toRel(c.from.uri),
                        line: c.fromRanges[0].start.line + 1
                    })) || [],
                    outgoing: result.callees?.map(c => ({
                        to: c.to.name,
                        file_path: toRel(c.to.uri),
                        line: c.fromRanges[0].start.line + 1
                    })) || []
                };

                // Log the generated data
                output.appendLine('📊 Generated data:');
                output.appendLine(JSON.stringify(data, null, 2));

                // Save to .vscode/callHierarchy.json
                const folders = vscode.workspace.workspaceFolders;
                if (folders && folders.length > 0) {
                    // Ensure .vscode directory exists
                    const vscodeDir = vscode.Uri.joinPath(folders[0].uri, '.vscode');
                    await vscode.workspace.fs.createDirectory(vscodeDir);

                    // Write the JSON file
                    const fileUri = vscode.Uri.joinPath(vscodeDir, 'callHierarchy.json');
                    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(JSON.stringify(data, null, 2)));

                    // Notify user and open the file
                    output.appendLine(`✅ Saved to ${fileUri.fsPath}`);
                    vscode.window.showInformationMessage(`Call hierarchy saved to ${fileUri.fsPath}`);

                    const jsonDoc = await vscode.workspace.openTextDocument(fileUri);
                    await vscode.window.showTextDocument(jsonDoc);
                } else {
                    vscode.window.showWarningMessage('No workspace folder open.');
                }

                output.appendLine('--- Complete ---');
            } catch (error) {
                // Handle any errors
                const msg = `Error: ${error}`;
                output.appendLine(msg);
                vscode.window.showErrorMessage(msg);
            }
        })
    );
}

/**
 * Extension deactivation.
 */
export function deactivate() {}
