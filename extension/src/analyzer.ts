// Import the VS Code extension API to access editor/commands/workspace types and functions.
import * as vscode from "vscode";
import { CallHierarchy } from "./types";

/**
 * Get call hierarchy for a symbol using the custom provider.
 * This function coordinates the entire call hierarchy analysis.
 *
 * @param document - The TextDocument being analyzed
 * @param position - The cursor position where the user wants to analyze a symbol
 * @returns An object containing the target symbol and its incoming/outgoing calls, or null if no symbol found
 */
export async function getCallHierarchyAt(document: vscode.TextDocument, position: vscode.Position) {
  try {
    // First: detect whether cursor is directly on a function definition
    const onDefinition = await isCursorOnDefinition(document, position);

    // Prepare call hierarchy item at cursor (lets language providers participate)
    const hierarchy = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      "vscode.prepareCallHierarchy",
      document.uri,
      position
    );

    if (!hierarchy || hierarchy.length === 0) {
      console.log("No symbol found at this position");
      return null;
    }

    const item = hierarchy[0]; // The function (or symbol) at cursor position

    // We'll return either the prepared item or a nearest-definition item
    // (for incoming calls when cursor is not on the definition).
    let incomingCalls: vscode.CallHierarchyIncomingCall[] | undefined | null;
    let outgoingCalls: vscode.CallHierarchyOutgoingCall[] | undefined | null;
    let resultFunctionItem: vscode.CallHierarchyItem = item;

    if (onDefinition) {
      // Cursor is on the function definition: use the item directly for both
      incomingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
        "vscode.provideIncomingCalls",
        item
      );
      outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        "vscode.provideOutgoingCalls",
        item
      );
    } else {
      // Cursor is not on definition. For outgoing calls, use the prepared item
      // (so callers can still inspect callees from the symbol under cursor).
      outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
        "vscode.provideOutgoingCalls",
        item
      );

      // For incoming calls, prefer the nearest definition upward in the
      // current document. If found, use that definition as the function
      // shown in the JSON result and request incoming calls for it.
      let defItem = findNearestDefinitionCallHierarchyItem(document, position, item.name);
      if (defItem) {
        resultFunctionItem = defItem;
        // Use the local customProvider when we created the CallHierarchyItem
        // ourselves. Some language providers will reject items they did not
        // create (resulting in "invalid item" errors), so call our
        // provider implementation directly.
        incomingCalls = await customProvider.provideCallHierarchyIncomingCalls(
          defItem,
          undefined as any
        );

        // If the user clicked on a call site inside the same function (e.g.
        // recursive call), our provider intentionally filters out
        // self-recursive callers. To ensure the JSON shows the local
        // definition as a caller (as requested), add a synthetic incoming
        // call pointing from the definition to the clicked call site.
        try {
          // Ensure incomingCalls is an array
          if (!incomingCalls) {
            incomingCalls = [];
          }

          // If the click was in the same document as the defItem
          if (document.uri.toString() === defItem.uri.toString()) {
            // Position of the clicked call (word range or single position)
            const callRange =
              document.getWordRangeAtPosition(position) ?? new vscode.Range(position, position);

            // If there's not already an incoming entry from this same function,
            // push one that points from the definition line to the call site.
            const alreadyHas = incomingCalls.some((c) => c.from.name === defItem!.name);
            if (!alreadyHas) {
              const callerRange = defItem.selectionRange;
              const synthetic = new vscode.CallHierarchyIncomingCall(
                new vscode.CallHierarchyItem(
                  vscode.SymbolKind.Function,
                  defItem.name,
                  "",
                  defItem.uri,
                  callerRange,
                  callerRange
                ),
                [callRange]
              );

              // If the click is inside the definition's file and appears to be
              // inside the function body (position line > def line), prefer
              // showing only the synthetic incoming (the definition) in the
              // JSON result — remove external callers like `main`.
              if (position.line > defItem.selectionRange.start.line) {
                incomingCalls = [synthetic];
              } else {
                incomingCalls.push(synthetic);
              }
            }
          }
        } catch (e) {
          // Non-fatal: if constructing the synthetic incoming fails, ignore
        }
      } else {
        // The user requested that when there is no enclosing `def` we
        // should produce an empty incoming list instead of querying
        // language providers. Set incomingCalls to an empty array.
        incomingCalls = [];
      }
    }

    return {
      function: resultFunctionItem,
      callers: incomingCalls,
      callees: outgoingCalls,
    };
  } catch (error) {
    console.error("Error in getCallHierarchy:", error);
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
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Determine whether the cursor is positioned on a Python function definition.
 *
 * Strategy:
 * 1. Check the word at the cursor and test the current line against a
 *    `def <name>(` pattern.
 * 2. If that fails, fall back to `vscode.prepareCallHierarchy` (so other
 *    language providers can participate) and verify the returned item's
 *    selectionRange line contains a `def` for the same name.
 */
export async function isCursorOnDefinition(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<boolean> {
  const wordRange = document.getWordRangeAtPosition(position);
  if (!wordRange) {
    return false;
  }

  const name = document.getText(wordRange);

  // Quick line-based detection
  const lineText = document.lineAt(position.line).text;
  const defPattern = new RegExp("^\\s*def\\s+" + escapeRegExp(name) + "\\s*\\(");
  if (defPattern.test(lineText)) {
    return true;
  }

  // Fallback: ask VS Code providers and inspect the returned item's selection
  try {
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      "vscode.prepareCallHierarchy",
      document.uri,
      position
    );
    if (!items || items.length === 0) {
      return false;
    }
    const selLine = items[0].selectionRange.start.line;
    const selLineText = document.lineAt(selLine).text;
    return defPattern.test(selLineText);
  } catch (e) {
    return false;
  }
}

/**
 * Find the nearest function definition upward in the document for `name` and
 * return a CallHierarchyItem pointing at that definition, or undefined.
 */
export function findNearestDefinitionCallHierarchyItem(
  document: vscode.TextDocument,
  position: vscode.Position,
  name: string
): vscode.CallHierarchyItem | undefined {
  // Generic def matcher for nearest-enclosing search (captures function name)
  const anyDefPattern = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;

  // Start with the indentation of the clicked line. We'll ignore any lines
  // that have indentation >= currentIndent. When we encounter a line with
  // indentation < currentIndent, we check it for a `def` and, if not a def,
  // lower currentIndent to that line's indent and continue searching upward.
  let currentIndent = document.lineAt(position.line).firstNonWhitespaceCharacterIndex;

  for (let ln = position.line - 1; ln >= 0; ln--) {
    const line = document.lineAt(ln);
    const text = line.text;

    // Skip blank lines
    if (!text.trim()) {
      continue;
    }

    const indent = line.firstNonWhitespaceCharacterIndex;

    // Ignore lines that are at the same or deeper indentation than where we clicked
    if (indent >= currentIndent) {
      continue;
    }

    const m = anyDefPattern.exec(text);

    // Now this line is less-indented than the last checkpoint. Check if it's a def
    if (m) {
      // Emit debug information to the extension output channel when available
      const foundName = m[1];

      const startChar = text.indexOf(foundName);
      const range = new vscode.Range(
        new vscode.Position(ln, startChar >= 0 ? startChar : 0),
        new vscode.Position(ln, (startChar >= 0 ? startChar : 0) + foundName.length)
      );
      return new vscode.CallHierarchyItem(
        vscode.SymbolKind.Function,
        foundName,
        "",
        document.uri,
        range,
        range
      );
    }

    // Not a def — lower the currentIndent to this line's indent and continue
    currentIndent = indent;
    // If we've reached top-level (indent 0) and it wasn't a def, there is no enclosing def
    if (currentIndent === 0) {
      break;
    }
  }

  return undefined;
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
  async prepareCallHierarchy(document: vscode.TextDocument, position: vscode.Position) {
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
        vscode.SymbolKind.Function, // Mark it as a function symbol
        wordText, // The function name
        "", // Detail string (empty for now; could show signature)
        document.uri, // File path
        nameRangeInDefFunc, // Full range of the item (whole function name)
        nameRangeInDefFunc // Selection range (what to highlight, should be identical to full range for now)
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
      vscode.SymbolKind.Function, // Mark it as a function symbol
      wordText, // The function name
      "", // Detail string (empty for now; could show signature)
      document.uri, // File path
      wordAtCursor, // Full range of the item (whole function name)
      wordAtCursor // Selection range (what to highlight, should be identical to full range for now)
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
    item: vscode.CallHierarchyItem // item represents the target function or variable
  ) {
    const results: vscode.CallHierarchyIncomingCall[] = [];
    const targetName = item.name;

    // Find all Python files in the workspace
    // Pattern: **/*.py matches all .py files recursively
    // Exclude: node_modules (npm packages don't contain user Python code)
    const pythonFiles = await vscode.workspace.findFiles("**/*.py", "**/node_modules/**");

    // Process each Python file in the workspace
    for (const fileUri of pythonFiles) {
      // Open the document (loads file content into memory)
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const text = doc.getText();
      const lines = text.split(/\r?\n/); // Split into lines (handle both \n and \r\n)

      // ============================================================
      // STEP 1: Find all calls to the target function using regex
      // (We no longer pre-build a defs map; instead we use
      // findNearestDefinitionCallHierarchyItem to resolve the caller)
      // ============================================================
      // Pattern: word boundary + target name + optional whitespace + "("
      // Example: "foo(" or "foo (" or "result = foo("
      const callRegex = new RegExp("\\b" + escapeRegExp(targetName) + "\\s*\\(", "g");

      // Pattern to detect function definition lines (to skip false positives)
      // Example: "def foo(" should NOT be counted as a call to "foo"
      const defLinePattern = new RegExp("^\\s*def\\s+" + escapeRegExp(targetName) + "\\s*\\(");

      let match: RegExpExecArray | null;

      // Iterate through all regex matches in the file
      while ((match = callRegex.exec(text)) !== null) {
        // Convert character offset to line/column position
        const pos = doc.positionAt(match.index);
        const line = pos.line;

        // FILTER: Skip function definition lines (don't treat def as a call)
        if (defLinePattern.test(lines[line] ?? "")) {
          continue;
        }

        // Range for the call occurrence
        const range =
          doc.getWordRangeAtPosition(pos) ??
          new vscode.Range(pos, pos.translate(0, targetName.length));

        // Ask the indentation-aware helper for the nearest enclosing def
        const callerItem = findNearestDefinitionCallHierarchyItem(doc, pos, targetName);

        // If the caller is the same as the target (self-recursive), skip it
        if (callerItem && callerItem.name === targetName) {
          continue;
        }

        if (callerItem) {
          // Use the found function definition as the caller
          const callerRange = callerItem.selectionRange;
          results.push(
            new vscode.CallHierarchyIncomingCall(
              new vscode.CallHierarchyItem(
                vscode.SymbolKind.Function,
                callerItem.name,
                "",
                fileUri,
                callerRange,
                callerRange
              ),
              [range]
            )
          );
        } else {
          // Module-level caller: no enclosing function found
          results.push(
            new vscode.CallHierarchyIncomingCall(
              new vscode.CallHierarchyItem(
                vscode.SymbolKind.Function,
                "<module>",
                "",
                fileUri,
                range,
                range
              ),
              [range]
            )
          );
        }
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
  async provideCallHierarchyOutgoingCalls(item: vscode.CallHierarchyItem) {
    const results: vscode.CallHierarchyOutgoingCall[] = [];
    const doc = await vscode.workspace.openTextDocument(item.uri);
    const text = doc.getText();

    // ============================================================
    // STEP 1: Locate the function definition line
    // ============================================================
    // Build a regex to match: "def <function_name>("
    const defPattern = new RegExp("^\\s*def\\s+" + escapeRegExp(item.name) + "\\s*\\(");
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
      const range =
        doc.getWordRangeAtPosition(pos) ?? new vscode.Range(pos, pos.translate(0, callee.length));

      // Add this outgoing call to the results
      // fromRanges: [range] indicates where in our function's body this call happens
      results.push(
        new vscode.CallHierarchyOutgoingCall(
          new vscode.CallHierarchyItem(
            vscode.SymbolKind.Function,
            callee, // Name of the function being called
            "", // Detail string (empty)
            item.uri, // Same file as the caller (our function)
            range, // Range of the callee reference
            range // Selection range (same)
          ),
          [range] // Array of ranges where this call appears
        )
      );
    }

    return results;
  },
};

export async function analyzeCallHierarchy(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel
) {
  output.show(true); // Show the panel immediately when extension activates

  try {
    output.appendLine("🚀 Command started");

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      // No file is currently open in the editor
      vscode.window.showInformationMessage("Open a Python file and place cursor on a function.");
      return;
    }

    // ============================================================
    // STEP 2: Log context information
    // ============================================================
    output.appendLine(`📄 File: ${editor.document.fileName}`);
    output.appendLine(
      `📍 Position: ${editor.selection.active.line}:${editor.selection.active.character}`
    );

    // ============================================================
    // STEP 3: Get the call hierarchy for the symbol at cursor
    // ============================================================
    const result = await getCallHierarchyAt(editor.document, editor.selection.active);
    if (!result) {
      // Cursor is not on a valid symbol (e.g., on whitespace or comment)
      vscode.window.showInformationMessage("No symbol found at current position.");
      return;
    }

    // ============================================================
    // STEP 4: Build JSON data structure with relative paths
    // ============================================================
    // Helper function: convert absolute file URIs to workspace-relative paths
    // Example: file:///Users/me/project/foo.py → foo.py (if project is workspace root)
    const toRel = (uri: vscode.Uri) => vscode.workspace.asRelativePath(uri, false);

    // Extract function information
    const funcName = result.function.name;
    const funcFile = toRel(result.function.uri);
    // Use selectionRange.start to get the exact name location (more reliable
    // for items constructed from a definition line)
    const funcLine = result.function.selectionRange.start.line + 1; // +1 for 1-indexed display

    // Build the CallHierarchy-shaped output directly from the provider results
    const analyzedData: CallHierarchy = {
      target: { name: funcName, filePath: funcFile, line: funcLine },
      incoming:
        (result.callers || []).map((caller) => ({
          name: caller.from.name,
          filePath: toRel(caller.from.uri),
          line: caller.from.range.start.line + 1,
        })) || [],
      outgoing:
        (result.callees || []).map((callee) => ({
          name: callee.to.name,
          filePath: toRel(callee.to.uri),
          line: callee.fromRanges[0].start.line + 1,
        })) || [],
    };

    // ============================================================
    // STEP 5: Log the generated data to output channel
    // ============================================================
    output.appendLine("📊 Generated data:");
    output.appendLine(JSON.stringify(analyzedData, null, 2));

    // ============================================================
    // STEP 6: Save to .vscode/callHierarchy.json
    // ============================================================
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      // Ensure .vscode directory exists
      const vscodeDir = vscode.Uri.joinPath(folders[0].uri, ".vscode");
      await vscode.workspace.fs.createDirectory(vscodeDir);

      // Write the JSON file
      const fileUri = vscode.Uri.joinPath(vscodeDir, "callHierarchy.json");
      await vscode.workspace.fs.writeFile(
        fileUri,
        Buffer.from(JSON.stringify(analyzedData, null, 2))
      );

      // ============================================================
      // STEP 7: Notify user and open the file
      // ============================================================
      output.appendLine(`✅ Saved to ${fileUri.fsPath}`);
      vscode.window.showInformationMessage(`Call hierarchy saved to ${fileUri.fsPath}`);

      // Open the JSON file in the editor so user can see the results
      const jsonDoc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(jsonDoc);
    } else {
      // No workspace folder is open (user opened a single file, not a folder)
      vscode.window.showWarningMessage("No workspace folder open.");
    }

    output.appendLine("--- Complete ---");
  } catch (error) {
    // ============================================================
    // Handle any errors that occur during execution
    // ============================================================
    const msg = `Error: ${error}`;
    output.appendLine(msg);
    vscode.window.showErrorMessage(msg);
  }
}
