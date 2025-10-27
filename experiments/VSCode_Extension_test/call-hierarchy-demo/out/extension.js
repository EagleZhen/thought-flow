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
/**
 * Get call hierarchy for a symbol using the custom provider.
 * This function coordinates the entire call hierarchy analysis.
 *
 * @param document - The TextDocument being analyzed
 * @param position - The cursor position where the user wants to analyze a symbol
 * @returns An object containing the target symbol and its incoming/outgoing calls, or null if no symbol found
 */
async function getCallHierarchy(document, position) {
    try {
        // Create a cancellation token for async operations
        // This allows us to terminate long-running operations if:
        // 1. The user triggers too many requests in rapid succession
        // 2. The operation takes too long (hangs on a large codebase)
        // 3. The user cancels the operation manually
        const cts = new vscode.CancellationTokenSource();
        // Step 1: Prepare call hierarchy - identify the symbol at cursor position
        // This returns either a single CallHierarchyItem or an array of them
        // (array case occurs when multiple symbols share the same name/position)
        const callHierarchy = await customProvider.prepareCallHierarchy(document, position, cts.token);
        // If we got an array, take the first item; otherwise use the single item
        const targetItem = Array.isArray(callHierarchy) ? callHierarchy[0] : callHierarchy;
        // Check if we found a valid symbol at the cursor position
        // If the cursor is on whitespace or an invalid location, targetItem will be undefined
        if (!targetItem) {
            cts.dispose(); // Clean up before returning
            return null;
        }
        // Step 2: Get incoming calls (who calls this function)
        // This searches the entire workspace for function calls to the target symbol
        const incomingCalls = await customProvider.provideCallHierarchyIncomingCalls(targetItem, cts.token);
        // Step 3: Get outgoing calls (what functions this function calls)
        // This scans the target function's body to find all function calls it makes
        const outgoingCalls = await customProvider.provideCallHierarchyOutgoingCalls(targetItem, cts.token);
        // Clean up the cancellation token to free resources
        cts.dispose();
        // Return the complete call hierarchy data structure
        // callers: functions that call the target (incoming edges)
        // callees: functions that the target calls (outgoing edges)
        return {
            function: targetItem,
            callers: incomingCalls || [],
            callees: outgoingCalls || []
        };
    }
    catch (error) {
        console.error('Error in getCallHierarchy:', error);
        throw error;
    }
}
/**
 * Escape special regex characters for safe pattern construction.
 *
 * When searching for function names using regex, we need to ensure that
 * special characters in the function name (like dots, parentheses, etc.)
 * are treated as literal characters, not regex metacharacters.
 *
 * Example: "my.func" should match literally, not "my" followed by any character.
 *
 * @param str - The string to escape (typically a function name)
 * @returns The escaped string safe for use in a RegExp constructor
 */
function escapeRegExp(str) {
    // Replace all regex special characters with their escaped versions
    // [.*+?^${}()|[\]\\] matches any of these special characters
    // '\\$&' replaces them with a backslash followed by the matched character
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Custom Call Hierarchy Provider for Python files.
 */
const customProvider = {
    /**
     * Identify the function symbol at the cursor position.
     *
     * This is the first step in call hierarchy analysis. It determines what symbol
     * (function, method, or variable) the user wants to analyze based on cursor position.
     *
     * Strategy:
     * 1. If cursor is on a function definition (def line), return that function
     * 2. Otherwise, return whatever word is at the cursor (could be a function call, variable, etc.)
     *
     * @param document - The document being analyzed
     * @param position - The cursor position
     * @returns A CallHierarchyItem representing the symbol, or undefined if no symbol found
     */
    async prepareCallHierarchy(document, position) {
        // Check if cursor is on a valid word/symbol
        // getWordRangeAtPosition returns the range of the word at the cursor,
        // or undefined if the cursor is on whitespace or a non-word character
        const wordAtCursor = document.getWordRangeAtPosition(position);
        if (!wordAtCursor) {
            // Cursor is on empty space, punctuation, or end of line
            return undefined;
        }
        // Extract the text of the word at cursor (e.g., "my_function")
        const wordText = document.getText(wordAtCursor);
        // Define regex pattern to match Python function definitions
        // Pattern: optional whitespace, "def", whitespace, function_name, optional whitespace, "("
        // Example matches: "def foo(", "    def bar(", "def my_func ("
        const defPattern = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;
        // Get the full text of the current line where the cursor is
        const currentLineText = document.lineAt(position.line).text;
        const currentLineMatch = defPattern.exec(currentLineText);
        // Check if:
        // 1. The current line is a function definition (def ...)
        // 2. The word at cursor matches the function name in the definition
        if (currentLineMatch && currentLineMatch[1] === wordText) {
            // Cursor is directly on the function name in a "def" line
            // Example: cursor on "foo" in "def foo(x, y):"
            // Find the exact character position of the function name in the line
            // (needed because there might be whitespace before "def")
            const startChar = currentLineText.indexOf(wordText);
            const nameRange = new vscode.Range(new vscode.Position(position.line, startChar), new vscode.Position(position.line, startChar + wordText.length));
            // Return a CallHierarchyItem for this function definition
            return new vscode.CallHierarchyItem(vscode.SymbolKind.Function, // Mark it as a function symbol
            wordText, // The function name
            '', // Detail string (empty for now; could show signature)
            document.uri, // File path
            nameRange, // Full range of the item (just the name)
            nameRange // Selection range (what to highlight)
            );
        }
        // If we reach here, cursor is NOT on a function definition line
        // It might be on:
        // - A function call: "foo(x)"
        // - A variable: "result = foo()"
        // - An import: "from module import foo"
        //
        // We still return a CallHierarchyItem so the user can analyze it
        // (e.g., to find where "foo" is called, even if cursor is on a call site)
        return new vscode.CallHierarchyItem(vscode.SymbolKind.Function, wordText, '', document.uri, wordAtCursor, wordAtCursor);
    },
    /**
     * Find all incoming calls (callers) for the target function.
     *
     * This searches all Python files in the workspace to find where the target
     * function is called. For each call site, it determines which function contains
     * that call (or marks it as module-level if not inside any function).
     *
     * Algorithm:
     * 1. Scan all .py files in the workspace
     * 2. Build a map of all function definitions in each file (name, start line, end line)
     * 3. Use regex to find all calls to the target function
     * 4. For each call, determine which function contains it (using the def map)
     * 5. Skip self-references and definition lines to avoid false positives
     *
     * @param item - The target function we're finding callers for
     * @returns Array of incoming calls with caller names and locations
     */
    async provideCallHierarchyIncomingCalls(item) {
        const results = [];
        const targetName = item.name;
        // Find all Python files in the workspace
        // Pattern: **/*.py matches all .py files recursively
        // Exclude: node_modules (npm packages don't contain user Python code)
        const pythonFiles = await vscode.workspace.findFiles('**/*.py', '**/node_modules/**');
        // Process each Python file in the workspace
        for (const fileUri of pythonFiles) {
            // Open the document (loads file content into memory)
            const doc = await vscode.workspace.openTextDocument(fileUri);
            const text = doc.getText();
            const lines = text.split(/\r?\n/); // Split into lines (handle both \n and \r\n)
            // ============================================================
            // STEP 1: Build a map of all function definitions in this file
            // ============================================================
            // This helps us identify which function contains each call site.
            // Structure: { name: "function_name", start: line_number, end: line_number }
            const defs = [];
            for (let i = 0; i < lines.length; i++) {
                // Match function definition lines: "def function_name("
                const match = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(lines[i]);
                if (match) {
                    // Found a function definition at line i
                    const funcName = match[1];
                    // Determine the function's boundaries using Python's indentation rules
                    // A function ends when we encounter a line with equal or less indentation
                    const indent = lines[i].search(/\S/); // Find first non-whitespace character
                    let end = i + 1;
                    // Walk forward through lines to find where the function ends
                    while (end < lines.length) {
                        const line = lines[end];
                        // If line is non-empty AND has indentation <= function's indentation, function ended
                        if (line.trim() && line.search(/\S/) <= indent)
                            break;
                        end++;
                    }
                    // Record this function's boundaries
                    defs.push({ name: funcName, start: i, end: end - 1 });
                }
            }
            // ============================================================
            // STEP 2: Find all calls to the target function using regex
            // ============================================================
            // Pattern: word boundary + target name + optional whitespace + "("
            // Example: "foo(" or "foo (" or "result = foo("
            const callRegex = new RegExp('\\b' + escapeRegExp(targetName) + '\\s*\\(', 'g');
            // Pattern to detect function definition lines (to skip false positives)
            // Example: "def foo(" should NOT be counted as a call to "foo"
            const defLinePattern = new RegExp('^\\s*def\\s+' + escapeRegExp(targetName) + '\\s*\\(');
            let match;
            // Iterate through all regex matches in the file
            while ((match = callRegex.exec(text)) !== null) {
                // Convert character offset to line/column position
                const pos = doc.positionAt(match.index);
                const line = pos.line;
                // ============================================================
                // FILTER 1: Skip function definition lines
                // ============================================================
                // If the match is on a "def foo(" line, it's not a call to foo,
                // it's the definition of foo itself. Skip it.
                if (defLinePattern.test(lines[line] ?? '')) {
                    continue;
                }
                // ============================================================
                // STEP 3: Determine which function contains this call site
                // ============================================================
                let caller = '<module>'; // Default: module-level (not inside any function)
                let callerDefLine = -1; // Track where the caller function is defined
                // Check if this call is inside any of the functions we found
                for (const def of defs) {
                    // Call is inside this function if:
                    // - Call line is after the function's def line
                    // - Call line is before or at the function's end line
                    if (line > def.start && line <= def.end) {
                        caller = def.name;
                        callerDefLine = def.start;
                    }
                }
                // ============================================================
                // FILTER 2: Skip self-recursive calls within the same function
                // ============================================================
                // If the caller is the same as the target, this is a recursive call
                // (the function calling itself from within its own body).
                // We skip these to prevent the function from appearing in its own
                // incoming list, which would be confusing.
                //
                // Example: In "def factorial(n): return n * factorial(n-1)",
                // the call to "factorial" inside "factorial" is skipped.
                if (caller === targetName) {
                    continue;
                }
                // ============================================================
                // STEP 4: Create a CallHierarchyIncomingCall for this call site
                // ============================================================
                // Create a range for this specific call location
                // Try to get the word range first, or fallback to manual range
                const range = doc.getWordRangeAtPosition(pos) ??
                    new vscode.Range(pos, pos.translate(0, targetName.length));
                // Create a range for the caller's definition
                // If caller is a function, use its def line
                // If caller is <module>, use the call site itself
                const callerRange = callerDefLine >= 0
                    ? new vscode.Range(new vscode.Position(callerDefLine, 0), new vscode.Position(callerDefLine, 0))
                    : range;
                // Add this incoming call to the results
                // fromRanges: [range] indicates where in the caller's code this call happens
                results.push(new vscode.CallHierarchyIncomingCall(new vscode.CallHierarchyItem(vscode.SymbolKind.Function, caller, // Name of the calling function
                '', // Detail string (empty)
                fileUri, // File containing the caller
                callerRange, // Range of the caller's definition
                callerRange // Selection range (same as range)
                ), [range] // Array of ranges where this call appears (just one range in our case)
                ));
            }
        }
        return results;
    },
    /**
     * Find all outgoing calls (callees) from the target function.
     *
     * This scans the body of the target function to find what other functions
     * it calls. Uses Python's indentation rules to determine function boundaries.
     *
     * Algorithm:
     * 1. Locate the function definition line
     * 2. Determine the function body boundaries using indentation
     * 3. Extract the function body text
     * 4. Use regex to find all function calls within the body
     * 5. Skip self-recursive calls
     *
     * Limitations:
     * - Regex-based, so may include false positives (e.g., function names in strings)
     * - Does not understand imports or scope (treats all identifiers as potential functions)
     * - Simple pattern matching, not full AST analysis
     *
     * @param item - The target function we're finding callees for
     * @returns Array of outgoing calls with callee names and locations
     */
    async provideCallHierarchyOutgoingCalls(item) {
        const results = [];
        const doc = await vscode.workspace.openTextDocument(item.uri);
        const text = doc.getText();
        // ============================================================
        // STEP 1: Locate the function definition line
        // ============================================================
        // Build a regex to match: "def <function_name>("
        const defPattern = new RegExp('^\\s*def\\s+' + escapeRegExp(item.name) + '\\s*\\(');
        let defLine = item.selectionRange.start.line;
        // Verify that defLine actually contains the function definition
        // If not (e.g., cursor was on a call site, not the definition), search for it
        if (!defPattern.test(doc.lineAt(defLine).text)) {
            let found = false;
            // Strategy 1: Search upwards from current position
            // (Handles case where cursor is inside function body)
            for (let ln = defLine; ln >= 0; ln--) {
                if (defPattern.test(doc.lineAt(ln).text)) {
                    defLine = ln;
                    found = true;
                    break;
                }
            }
            // Strategy 2: If not found above, search entire document
            // (Handles case where cursor is before the definition)
            if (!found) {
                for (let ln = 0; ln < doc.lineCount; ln++) {
                    if (defPattern.test(doc.lineAt(ln).text)) {
                        defLine = ln;
                        break;
                    }
                }
            }
        }
        // ============================================================
        // STEP 2: Determine function body boundaries using indentation
        // ============================================================
        // In Python, a function's body is defined by indentation level
        // Example:
        //   def foo():        <- defLine, defIndent = 2
        //       x = 1         <- bodyStart, bodyIndent = 6
        //       return x      <- still in body (indent = 6)
        //   def bar():        <- dedented, function ended
        // Get the indentation level of the "def" line
        const defIndent = doc.lineAt(defLine).firstNonWhitespaceCharacterIndex;
        // Find the first non-blank line after the function definition
        let bodyStart = defLine + 1;
        while (bodyStart < doc.lineCount && !doc.lineAt(bodyStart).text.trim()) {
            bodyStart++;
        }
        // Check if function has a body at all
        if (bodyStart >= doc.lineCount) {
            return results; // No body (e.g., stub function at end of file)
        }
        // Get the indentation level of the first body line
        const bodyIndent = doc.lineAt(bodyStart).firstNonWhitespaceCharacterIndex;
        // Validate that body is properly indented
        // Body must have MORE indentation than the def line
        if (bodyIndent <= defIndent) {
            return results; // Not a proper indented block (malformed Python)
        }
        // Find the end of the function body
        // A function ends when we encounter a line with LESS indentation than the body
        let bodyEnd = bodyStart;
        for (let ln = bodyStart; ln < doc.lineCount; ln++) {
            const lineText = doc.lineAt(ln).text;
            // If line is non-empty (not just whitespace)
            if (lineText.trim()) {
                const lineIndent = doc.lineAt(ln).firstNonWhitespaceCharacterIndex;
                // If this line is dedented below body level, function ended
                if (lineIndent < bodyIndent) {
                    break;
                }
            }
            // This line is still part of the function
            bodyEnd = ln;
        }
        // ============================================================
        // STEP 3: Extract the function body text
        // ============================================================
        const bodyStartOffset = doc.offsetAt(new vscode.Position(bodyStart, 0));
        const bodyEndOffset = doc.offsetAt(doc.lineAt(bodyEnd).range.end);
        const bodyText = text.substring(bodyStartOffset, bodyEndOffset);
        // ============================================================
        // STEP 4: Search for all function calls within the body
        // ============================================================
        // Pattern: identifier followed by "("
        // Matches: foo(), bar(x), my_func (x, y)
        // [A-Za-z_] = must start with letter or underscore
        // [A-Za-z0-9_]* = can contain letters, digits, underscores
        // \s* = optional whitespace before "("
        const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
        let match;
        // Iterate through all function calls found in the body
        while ((match = callPattern.exec(bodyText)) !== null) {
            const callee = match[1]; // The function name being called
            // ============================================================
            // FILTER: Skip self-recursive calls
            // ============================================================
            // If the function calls itself (recursion), skip it
            // Example: In "def factorial(n): return n * factorial(n-1)",
            // we skip the call to "factorial" inside "factorial"
            if (callee === item.name) {
                continue;
            }
            // ============================================================
            // STEP 5: Create a CallHierarchyOutgoingCall for this callee
            // ============================================================
            // Calculate the absolute position in the document
            // match.index is relative to bodyText, so we add bodyStartOffset
            const offset = bodyStartOffset + match.index;
            const pos = doc.positionAt(offset);
            // Create a range for this specific call location
            const range = doc.getWordRangeAtPosition(pos) ??
                new vscode.Range(pos, pos.translate(0, callee.length));
            // Add this outgoing call to the results
            // fromRanges: [range] indicates where in our function's body this call happens
            results.push(new vscode.CallHierarchyOutgoingCall(new vscode.CallHierarchyItem(vscode.SymbolKind.Function, callee, // Name of the function being called
            '', // Detail string (empty)
            item.uri, // Same file as the caller (our function)
            range, // Range of the callee reference
            range // Selection range (same)
            ), [range] // Array of ranges where this call appears
            ));
        }
        return results;
    }
};
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
    context.subscriptions.push(vscode.languages.registerCallHierarchyProvider({ scheme: 'file', language: 'python' }, customProvider));
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
            const result = await getCallHierarchy(editor.document, editor.selection.active);
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