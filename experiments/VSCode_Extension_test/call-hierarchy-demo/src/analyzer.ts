// Import the VS Code extension API to access editor/commands/workspace types and functions.
import * as vscode from 'vscode';

/**
 * Get call hierarchy for a symbol using the custom provider.
 * This function coordinates the entire call hierarchy analysis.
 *
 * @param document - The TextDocument being analyzed
 * @param position - The cursor position where the user wants to analyze a symbol
 * @returns An object containing the target symbol and its incoming/outgoing calls, or null if no symbol found
 */
export async function getCallHierarchy(
    document: vscode.TextDocument,
    position: vscode.Position
) {
    try {
        // Create a cancellation token for async operations
        // This allows us to terminate long-running operations if:
        // 1. The user triggers too many requests in rapid succession
        // 2. The operation takes too long (hangs on a large codebase)
        // 3. The user cancels the operation manually
        const cts = new vscode.CancellationTokenSource();

        // Step 1: Prepare call hierarchy - identify the symbol at cursor position
        // This returns either a single CallHierarchyItem or an array of them
        // (array case occurs when multiple symbols share the same name/position,
        // or when the cursor is on a location where there are multiple valid interpretations)
        const callHierarchy = await customProvider.prepareCallHierarchy(document, position, cts.token);

        // If we got an array, take the first item; otherwise use the single item (more common)
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
    } catch (error) {
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
export function escapeRegExp(str: string): string {
    // Replace all regex special characters with their escaped versions
    // [.*+?^${}()|[\]\\] matches any of these special characters
    // '\\$&' replaces them with a backslash followed by the matched character
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Custom Call Hierarchy Provider for Python files. (The real functionality)
 */
export const customProvider: vscode.CallHierarchyProvider = {
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
    async prepareCallHierarchy(
        document: vscode.TextDocument,
        position: vscode.Position,
    ) {
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
            const nameRangeInDefFunc = new vscode.Range(
                new vscode.Position(position.line, startChar),
                new vscode.Position(position.line, startChar + wordText.length)
            );

            // Return a CallHierarchyItem for this function definition
            return new vscode.CallHierarchyItem(
                vscode.SymbolKind.Function,      // Mark it as a function symbol
                wordText,                         // The function name
                '',                               // Detail string (empty for now; could show signature)
                document.uri,                     // File path
                nameRangeInDefFunc,               // Full range of the item (whole function name)
                nameRangeInDefFunc                // Selection range (what to highlight, should be identical to full range for now)
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
        return new vscode.CallHierarchyItem(
            vscode.SymbolKind.Function,      // Mark it as a function symbol
            wordText,                         // The function name
            '',                               // Detail string (empty for now; could show signature)
            document.uri,                     // File path
            wordAtCursor,                     // Full range of the item (whole function name)
            wordAtCursor                      // Selection range (what to highlight, should be identical to full range for now)
        );
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
    async provideCallHierarchyIncomingCalls(
        item: vscode.CallHierarchyItem, // item represents the target function or variable
    ) {
        const results: vscode.CallHierarchyIncomingCall[] = [];
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
            const defs: { name: string; start: number; end: number }[] = [];

            // Process each line to find function definitions
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
                        if (line.trim() && line.search(/\S/) <= indent) break;
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

            let match: RegExpExecArray | null;

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
                let callerDefLine = -1;  // Track where the caller function is defined

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
                results.push(new vscode.CallHierarchyIncomingCall(
                    new vscode.CallHierarchyItem(
                        vscode.SymbolKind.Function,
                        caller,       // Name of the calling function
                        '',           // Detail string (empty)
                        fileUri,      // File containing the caller
                        callerRange,  // Full range of the caller's definition
                        callerRange   // Selection range (same as full range)
                    ),
                    [range]  // Array of ranges where this call appears (just one range in our case)
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
    async provideCallHierarchyOutgoingCalls(
        item: vscode.CallHierarchyItem,
    ) {
        const results: vscode.CallHierarchyOutgoingCall[] = [];
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
        let match: RegExpExecArray | null;

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
            results.push(new vscode.CallHierarchyOutgoingCall(
                new vscode.CallHierarchyItem(
                    vscode.SymbolKind.Function,
                    callee,      // Name of the function being called
                    '',          // Detail string (empty)
                    item.uri,    // Same file as the caller (our function)
                    range,       // Range of the callee reference
                    range        // Selection range (same)
                ),
                [range]  // Array of ranges where this call appears
            ));
        }

        return results;
    }
};
