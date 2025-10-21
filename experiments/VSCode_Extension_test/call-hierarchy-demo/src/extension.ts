// Import the VS Code extension API to access editor/commands/workspace types and functions.
import * as vscode from 'vscode';

/**
 * Helper function to get call hierarchy using VS Code's built-in commands.
 *
 * @param document - The Python document being analyzed
 * @param position - The cursor position within the document
 * @returns Call hierarchy data with incoming and outgoing calls, or null if not found
 */
async function getCallHierarchy(
    document: vscode.TextDocument,
    position: vscode.Position
) {
    try {
        console.log('🔍 Preparing call hierarchy...');

        // Prepare the call hierarchy at the cursor position.
        const hierarchyItems = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
            'vscode.prepareCallHierarchy',
            document.uri,
            position
        );

        console.log(`📋 Hierarchy items found: ${hierarchyItems?.length || 0}`);

        if (!hierarchyItems || hierarchyItems.length === 0) {
            console.log('❌ No hierarchy items found');
            return null;
        }

        // Get the symbol at the cursor (function, class, or method).
        const targetSymbol = hierarchyItems[0];
        console.log(`🎯 Working with symbol: ${targetSymbol.name}`);

        console.log('📞 Getting incoming calls...');
        // Get all callers of this symbol.
        const incomingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
            'vscode.provideIncomingCalls',
            targetSymbol
        );
        console.log(`📞 Incoming calls found: ${incomingCalls?.length || 0}`);

        console.log('📤 Getting outgoing calls...');
        // Get all callees (functions this symbol calls).
        const outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
            'vscode.provideOutgoingCalls',
            targetSymbol
        );
        console.log(`📤 Outgoing calls found: ${outgoingCalls?.length || 0}`);

        // Return the call hierarchy data.
        return {
            function: targetSymbol,
            callers: incomingCalls || [],
            callees: outgoingCalls || []
        };
    } catch (error) {
        console.error('❌ Error in getCallHierarchy:', error);
        throw error;
    }
}

/**
 * Escape special regex characters in a string for safe regex construction.
 *
 * @param inputString - The string to escape
 * @returns The escaped string safe for use in regex patterns
 */
function escapeRegExp(inputString: string): string {
    return inputString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Custom Call Hierarchy Provider for Python files.
 * Provides a simple regex-based call hierarchy analysis for Python code.
 */
const customProvider: vscode.CallHierarchyProvider = {
    /**
     * Prepare the call hierarchy by identifying the symbol at the cursor position.
     *
     * @param document - The Python document being analyzed
     * @param position - The cursor position
     * @returns A CallHierarchyItem representing the symbol, or undefined if not found
     */
    async prepareCallHierarchy(
        document: vscode.TextDocument,
        position: vscode.Position,
    ) {
        // Find the word at the cursor position.
        const nameRange = document.getWordRangeAtPosition(position);
        if (!nameRange) {
            return undefined;
        }

        // Create a CallHierarchyItem for the symbol at the cursor.
        const symbolName = document.getText(nameRange);
        const symbolItem = new vscode.CallHierarchyItem(
            vscode.SymbolKind.Function,
            symbolName,
            '',
            document.uri,
            nameRange,  // fullRange - the entire function
            nameRange   // selectionRange - the identifier/name part to highlight
        );
        return symbolItem;
    },

    /**
     * Find all incoming calls (callers) for the given symbol.
     * Searches all Python files in the workspace for function calls.
     *
     * @param item - The CallHierarchyItem to find callers for
     * @returns Array of incoming calls with their locations
     */
    async provideCallHierarchyIncomingCalls(
        item: vscode.CallHierarchyItem,
    ) {
        const incomingCallsList: vscode.CallHierarchyIncomingCall[] = [];
        const targetFunctionName = item.name;

        // Search all Python files in the workspace (excluding node_modules).
        const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');

        // For every Python file found, open it (openTextDocument) and read its content (getText()).
        for (const fileUri of pythonFiles) {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const fileContent = document.getText();

            // Build regex to find where the function is called: function_name followed by '('.
            const functionCallRegex = new RegExp('\\b' + escapeRegExp(targetFunctionName) + '\\s*\\(', 'g');
            // Runs the regex repeatedly across the text, one match at a time.
            let regexMatch: RegExpExecArray | null;

            // Each time a match is found, create a CallHierarchyItem for the caller location.
            while ((regexMatch = functionCallRegex.exec(fileContent)) !== null) {
                // Get the position and range of the function call.
                const callPosition = document.positionAt(regexMatch.index);
                const callRange = document.getWordRangeAtPosition(callPosition) ??
                    new vscode.Range(callPosition, callPosition.translate(0, targetFunctionName.length));

                // Create a CallHierarchyItem for the caller location.
                const callerItem = new vscode.CallHierarchyItem(
                    vscode.SymbolKind.Function,
                    document.getText(callRange),
                    '',
                    fileUri,
                    callRange,
                    callRange
                );

                // Add the incoming call to results.
                incomingCallsList.push(new vscode.CallHierarchyIncomingCall(callerItem, [callRange]));
            }
        }

        return incomingCallsList;
    },

    /**
     * Find all outgoing calls (callees) from the given symbol.
     * Scans the function body to find all function calls made within it.
     * Uses Python's indentation-based syntax to determine function body boundaries.
     *
     * @param item - The CallHierarchyItem to find callees for
     * @returns Array of outgoing calls with their locations
     */
    async provideCallHierarchyOutgoingCalls(
        item: vscode.CallHierarchyItem,
    ) {
        const outgoingCallsList: vscode.CallHierarchyOutgoingCall[] = [];
        const document = await vscode.workspace.openTextDocument(item.uri);
        const fullDocumentText = document.getText();

        // Extract the function body using Python's indentation rules.
        const functionDefLine = item.selectionRange.start.line;
        const totalLineCount = document.lineCount;
        const functionDefIndent = document.lineAt(functionDefLine).firstNonWhitespaceCharacterIndex;

        // Find the first non-empty line after the function definition.
        let firstBodyLine = functionDefLine + 1;
        while (firstBodyLine < totalLineCount && document.lineAt(firstBodyLine).text.trim().length === 0) {
            firstBodyLine++;
        }

        if (firstBodyLine >= totalLineCount) {
            return outgoingCallsList; // No function body found.
        }

        const bodyIndentLevel = document.lineAt(firstBodyLine).firstNonWhitespaceCharacterIndex;
        if (bodyIndentLevel <= functionDefIndent) {
            return outgoingCallsList; // Not a proper indented block.
        }

        // Mark the start of the function body.
        const bodyStartPosition = new vscode.Position(firstBodyLine, 0);
        const bodyStartOffset = document.offsetAt(bodyStartPosition);

        // Find the end of the function body by checking indentation.
        let lastBodyLine = firstBodyLine;
        for (let lineNumber = firstBodyLine; lineNumber < totalLineCount; lineNumber++) {
            const currentLineText = document.lineAt(lineNumber).text;

            // Allow blank lines within the function body.
            if (currentLineText.trim().length === 0) {
                lastBodyLine = lineNumber;
                continue;
            }

            const currentLineIndent = document.lineAt(lineNumber).firstNonWhitespaceCharacterIndex;
            if (currentLineIndent < bodyIndentLevel) {
                break; // Function body ended (dedented to lower level).
            }
            lastBodyLine = lineNumber;
        }

        const bodyEndPosition = document.lineAt(lastBodyLine).range.end;
        const bodyEndOffset = document.offsetAt(bodyEndPosition);

        if (bodyStartOffset < 0 || bodyEndOffset < 0 || bodyEndOffset <= bodyStartOffset) {
            return outgoingCallsList;
        }

        // Extract the function body text.
        const functionBodyText = fullDocumentText.substring(bodyStartOffset, bodyEndOffset);

        // Find all function calls in the body using regex pattern: identifier followed by '('.
        const functionCallPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
        let regexMatch: RegExpExecArray | null;

        while ((regexMatch = functionCallPattern.exec(functionBodyText)) !== null) {
            const calledFunctionName = regexMatch[1];

            // Skip self-recursive calls.
            if (calledFunctionName === item.name) {
                continue;
            }

            // Calculate the absolute position in the document.
            const absoluteOffset = bodyStartOffset + regexMatch.index;
            const callPosition = document.positionAt(absoluteOffset);
            const callRange = document.getWordRangeAtPosition(callPosition) ??
                new vscode.Range(callPosition, callPosition.translate(0, calledFunctionName.length));

            // Create a CallHierarchyItem for the callee.
            const calleeItem = new vscode.CallHierarchyItem(
                vscode.SymbolKind.Function,
                calledFunctionName,
                '',
                item.uri,
                callRange,
                callRange
            );

            // Add the outgoing call to results.
            outgoingCallsList.push(new vscode.CallHierarchyOutgoingCall(calleeItem, [callRange]));
        }

        return outgoingCallsList;
    }
};

/**
 * Extension activation function.
 * Called when the extension is activated (e.g., when the command is first invoked).
 *
 * @param context - The extension context provided by VS Code
 */
export function activate(context: vscode.ExtensionContext) {
    // Create an output channel for logging extension activity.
    const outputChannel = vscode.window.createOutputChannel('Call Hierarchy Debug');
    outputChannel.show(true);

    // Register the custom call hierarchy provider for Python files.
    context.subscriptions.push(
        vscode.languages.registerCallHierarchyProvider(
            { scheme: 'file', language: 'python' },
            customProvider
        )
    );

    // Register the command that analyzes call hierarchy and exports to JSON.
    const commandDisposable = vscode.commands.registerCommand(
        'callHierarchyDemo.showCallHierarchy',
        async () => {
            try {
                console.log('🚀 Command started - Show Call Hierarchy');
                outputChannel.appendLine('🚀 Command started - Show Call Hierarchy');

                // Check if there's an active editor with a file open.
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    const errorMessage = 'Open a Python file and place the cursor on a function name first.';
                    console.log('❌ ' + errorMessage);
                    outputChannel.appendLine('❌ ' + errorMessage);
                    vscode.window.showInformationMessage(errorMessage);
                    return;
                }

                // Log the current file and cursor position.
                console.log(`📄 Active file: ${activeEditor.document.fileName}`);
                console.log(`📍 Cursor position: ${activeEditor.selection.active.line}:${activeEditor.selection.active.character}`);
                outputChannel.appendLine(`📄 Active file: ${activeEditor.document.fileName}`);
                outputChannel.appendLine(`📍 Cursor position: ${activeEditor.selection.active.line}:${activeEditor.selection.active.character}`);

                // Show progress message to the user.
                vscode.window.showInformationMessage('Analyzing call hierarchy...');

                // Get the call hierarchy for the symbol at the cursor.
                const hierarchyResult = await getCallHierarchy(activeEditor.document, activeEditor.selection.active);
                if (!hierarchyResult) {
                    const errorMessage = 'No symbol or no provider found at the current position.';
                    console.log('❌ ' + errorMessage);
                    outputChannel.appendLine('❌ ' + errorMessage);
                    vscode.window.showInformationMessage(errorMessage);
                    return;
                }

                console.log('✅ Call hierarchy data retrieved successfully');
                outputChannel.appendLine('✅ Call hierarchy data retrieved successfully');

                // Convert file URIs to workspace-relative paths for portability.
                const toRelativePath = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);

                // Build the JSON data structure with the function and its relationships.
                const callHierarchyData = {
                    function: hierarchyResult.function.name,
                    current_file: toRelativePath(hierarchyResult.function.uri),
                    line: hierarchyResult.function.range.start.line + 1,
                    incoming: hierarchyResult.callers?.map(caller => ({
                        from: caller.from.name,
                        file_path: toRelativePath(caller.from.uri),
                        line: caller.fromRanges[0].start.line + 1
                    })) || [],
                    outgoing: hierarchyResult.callees?.map(callee => ({
                        to: callee.to.name,
                        file_path: toRelativePath(callee.to.uri),
                        line: callee.fromRanges[0].start.line + 1
                    })) || []
                };

                console.log('📊 Generated data:', callHierarchyData);
                outputChannel.appendLine('📊 Generated data:');
                outputChannel.appendLine(JSON.stringify(callHierarchyData, null, 2));

                // Save the call hierarchy data to a JSON file.
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    try {
                        // Ensure the .vscode directory exists.
                        const vscodeDirectoryUri = vscode.Uri.joinPath(workspaceFolders[0].uri, '.vscode');
                        console.log(`📁 Creating directory: ${vscodeDirectoryUri.fsPath}`);
                        outputChannel.appendLine(`📁 Creating directory: ${vscodeDirectoryUri.fsPath}`);
                        await vscode.workspace.fs.createDirectory(vscodeDirectoryUri);

                        // Write the JSON data to callHierarchy.json.
                        const outputFileUri = vscode.Uri.joinPath(vscodeDirectoryUri, 'callHierarchy.json');
                        console.log(`💾 Writing file: ${outputFileUri.fsPath}`);
                        outputChannel.appendLine(`💾 Writing file: ${outputFileUri.fsPath}`);
                        await vscode.workspace.fs.writeFile(
                            outputFileUri,
                            Buffer.from(JSON.stringify(callHierarchyData, null, 2))
                        );

                        const successMessage = `✅ Call hierarchy saved to ${outputFileUri.fsPath}`;
                        console.log(successMessage);
                        outputChannel.appendLine(successMessage);
                        vscode.window.showInformationMessage(successMessage);

                        // Open the generated JSON file in the editor.
                        const generatedDocument = await vscode.workspace.openTextDocument(outputFileUri);
                        await vscode.window.showTextDocument(generatedDocument);

                    } catch (fileError) {
                        const errorMessage = `❌ Error writing file: ${fileError}`;
                        console.error(errorMessage);
                        outputChannel.appendLine(errorMessage);
                        vscode.window.showErrorMessage(errorMessage);
                    }
                } else {
                    const warningMessage = '⚠️ No workspace folder open — cannot save callHierarchy.json.';
                    console.log(warningMessage);
                    outputChannel.appendLine(warningMessage);
                    vscode.window.showWarningMessage(warningMessage);
                }

                // Mark completion in the output channel.
                outputChannel.appendLine('--- Call Hierarchy Analysis Complete ---');
                outputChannel.show(true);

            } catch (error) {
                const errorMessage = `❌ Unexpected error: ${error}`;
                console.error(errorMessage);
                outputChannel.appendLine(errorMessage);
                vscode.window.showErrorMessage(errorMessage);
            }
        }
    );

    context.subscriptions.push(commandDisposable);
}

/**
 * Extension deactivation function.
 * Called when the extension is deactivated.
 * No cleanup needed for this extension.
 */
export function deactivate() {}
