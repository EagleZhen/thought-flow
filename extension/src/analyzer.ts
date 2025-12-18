import * as vscode from "vscode";

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
    // Create a cancellation token for async operations
    const cts = new vscode.CancellationTokenSource();

    // Step 1: Prepare call hierarchy - identify the symbol at cursor position
    const callHierarchy = await customProvider.prepareCallHierarchy(document, position, cts.token);

    // If we got an array, take the first item; otherwise use the single item
    const targetItem = Array.isArray(callHierarchy) ? callHierarchy[0] : callHierarchy;

    // Check if we found a valid symbol at the cursor position
    if (!targetItem) {
      cts.dispose(); // Clean up before returning
      return null;
    }

    // Step 2: Get incoming calls (who calls this function)
    const incomingCalls = await customProvider.provideCallHierarchyIncomingCalls(
      targetItem,
      cts.token
    );

    // Step 3: Get outgoing calls (what functions this function calls)
    const outgoingCalls = await customProvider.provideCallHierarchyOutgoingCalls(
      targetItem,
      cts.token
    );

    // Clean up the cancellation token
    cts.dispose();

    // Return the complete call hierarchy data structure
    return {
      function: targetItem,
      callers: incomingCalls || [],
      callees: outgoingCalls || [],
    };
  } catch (error) {
    console.error("Error in getCallHierarchy:", error);
    throw error;
  }
}

/**
 * Escape special regex characters for safe pattern construction.
 * @param str - The string to escape
 * @returns The escaped string
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Custom Call Hierarchy Provider for Python files.
 */
export const customProvider: vscode.CallHierarchyProvider = {
  /**
   * Identify the function symbol at the cursor position.
   */
  async prepareCallHierarchy(document: vscode.TextDocument, position: vscode.Position) {
    // Check if cursor is on a valid word/symbol
    const wordAtCursor = document.getWordRangeAtPosition(position);
    if (!wordAtCursor) {
      return undefined;
    }

    // Extract the text of the word at cursor
    const wordText = document.getText(wordAtCursor);

    // Regex pattern to match Python function definitions
    const defPattern = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/;

    const currentLineText = document.lineAt(position.line).text;
    const currentLineMatch = defPattern.exec(currentLineText);

    // Check if cursor is on the function name in a definition line
    if (currentLineMatch && currentLineMatch[1] === wordText) {
      const startChar = currentLineText.indexOf(wordText);
      const nameRangeInDefFunc = new vscode.Range(
        new vscode.Position(position.line, startChar),
        new vscode.Position(position.line, startChar + wordText.length)
      );

      return new vscode.CallHierarchyItem(
        vscode.SymbolKind.Function,
        wordText,
        "",
        document.uri,
        nameRangeInDefFunc,
        nameRangeInDefFunc
      );
    }

    // If not on a definition line, return the word as a reference
    return new vscode.CallHierarchyItem(
      vscode.SymbolKind.Function,
      wordText,
      "",
      document.uri,
      wordAtCursor,
      wordAtCursor
    );
  },

  /**
   * Find all incoming calls (callers) for the target function.
   * Scans all Python files in the workspace.
   */
  async provideCallHierarchyIncomingCalls(item: vscode.CallHierarchyItem) {
    const results: vscode.CallHierarchyIncomingCall[] = [];
    const targetName = item.name;

    // Find all Python files in the workspace
    const pythonFiles = await vscode.workspace.findFiles("**/*.py", "**/node_modules/**");

    for (const fileUri of pythonFiles) {
      const doc = await vscode.workspace.openTextDocument(fileUri);
      const text = doc.getText();
      const lines = text.split(/\r?\n/);

      // Build a map of all function definitions in this file
      // Structure: { name: "function_name", start: line_number, end: line_number }
      const defs: { name: string; start: number; end: number }[] = [];

      for (let i = 0; i < lines.length; i++) {
        const match = /^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(lines[i]);
        if (match) {
          const funcName = match[1];
          const indent = lines[i].search(/\S/);
          let end = i + 1;

          // Walk forward to find where the function ends based on indentation
          while (end < lines.length) {
            const line = lines[end];
            if (line.trim() && line.search(/\S/) <= indent) break;
            end++;
          }
          defs.push({ name: funcName, start: i, end: end - 1 });
        }
      }

      // Find all calls to the target function using regex
      const callRegex = new RegExp("\\b" + escapeRegExp(targetName) + "\\s*\\(", "g");
      const defLinePattern = new RegExp("^\\s*def\\s+" + escapeRegExp(targetName) + "\\s*\\(");

      let match: RegExpExecArray | null;

      while ((match = callRegex.exec(text)) !== null) {
        const pos = doc.positionAt(match.index);
        const line = pos.line;

        // Filter 1: Skip definition lines
        if (defLinePattern.test(lines[line] ?? "")) {
          continue;
        }

        // Determine which function contains this call site
        let caller = "<module>"; // Default: module-level
        let callerDefLine = -1;

        for (const def of defs) {
          if (line > def.start && line <= def.end) {
            caller = def.name;
            callerDefLine = def.start;
          }
        }

        // Filter 2: Skip self-recursive calls
        if (caller === targetName) {
          continue;
        }

        // Create ranges
        const range =
          doc.getWordRangeAtPosition(pos) ??
          new vscode.Range(pos, pos.translate(0, targetName.length));

        const callerRange =
          callerDefLine >= 0
            ? new vscode.Range(
                new vscode.Position(callerDefLine, 0),
                new vscode.Position(callerDefLine, 0)
              )
            : range;

        results.push(
          new vscode.CallHierarchyIncomingCall(
            new vscode.CallHierarchyItem(
              vscode.SymbolKind.Function,
              caller,
              "",
              fileUri,
              callerRange,
              callerRange
            ),
            [range]
          )
        );
      }
    }

    return results;
  },

  /**
   * Find all outgoing calls (callees) from the target function.
   * Uses 'vscode.executeDefinitionProvider' to resolve the real definition of called functions.
   */
  async provideCallHierarchyOutgoingCalls(item: vscode.CallHierarchyItem) {
    const results: vscode.CallHierarchyOutgoingCall[] = [];
    const doc = await vscode.workspace.openTextDocument(item.uri);
    const text = doc.getText();

    // 1. Locate the function definition line
    const defPattern = new RegExp("^\\s*def\\s+" + escapeRegExp(item.name) + "\\s*\\(");
    let defLine = item.selectionRange.start.line;

    // If cursor wasn't on def line, search for it
    if (!defPattern.test(doc.lineAt(defLine).text)) {
      let found = false;
      // Search upwards
      for (let ln = defLine; ln >= 0; ln--) {
        if (defPattern.test(doc.lineAt(ln).text)) {
          defLine = ln;
          found = true;
          break;
        }
      }
      // Search entire file if not found
      if (!found) {
        for (let ln = 0; ln < doc.lineCount; ln++) {
          if (defPattern.test(doc.lineAt(ln).text)) {
            defLine = ln;
            break;
          }
        }
      }
    }

    // 2. Determine function body boundaries
    const defIndent = doc.lineAt(defLine).firstNonWhitespaceCharacterIndex;
    let bodyStart = defLine + 1;

    // Skip empty lines/comments to find start of body
    while (bodyStart < doc.lineCount && !doc.lineAt(bodyStart).text.trim()) {
      bodyStart++;
    }

    if (bodyStart >= doc.lineCount) return results;

    const bodyIndent = doc.lineAt(bodyStart).firstNonWhitespaceCharacterIndex;
    if (bodyIndent <= defIndent) return results; // Malformed or empty body

    // Find end of body
    let bodyEnd = bodyStart;
    for (let ln = bodyStart; ln < doc.lineCount; ln++) {
      const lineText = doc.lineAt(ln).text;
      if (lineText.trim()) {
        const lineIndent = doc.lineAt(ln).firstNonWhitespaceCharacterIndex;
        if (lineIndent < bodyIndent) {
          break;
        }
      }
      bodyEnd = ln;
    }

    // 3. Extract body text
    const bodyStartOffset = doc.offsetAt(new vscode.Position(bodyStart, 0));
    const bodyEndOffset = doc.offsetAt(doc.lineAt(bodyEnd).range.end);
    const bodyText = text.substring(bodyStartOffset, bodyEndOffset);

    // 4. Search for function calls
    const callPattern = /\b([A-Za-z_][A-Za-z0-9_]*)\s*\(/g;
    let match: RegExpExecArray | null;

    while ((match = callPattern.exec(bodyText)) !== null) {
      const calleeName = match[1];

      // Filter: Skip self-recursion
      if (calleeName === item.name) continue;

      const offset = bodyStartOffset + match.index;
      const pos = doc.positionAt(offset);
      const range =
        doc.getWordRangeAtPosition(pos) ??
        new vscode.Range(pos, pos.translate(0, calleeName.length));

      // [CRITICAL FIX] Resolve the real definition location
      // This allows us to handle imports correctly (e.g. 'multiply' imported from another file)
      let definitionItem: vscode.CallHierarchyItem | undefined;

      try {
        const definitions = await vscode.commands.executeCommand<
          (vscode.Location | vscode.LocationLink)[]
        >("vscode.executeDefinitionProvider", item.uri, pos);

        if (definitions && definitions.length > 0) {
          const def = definitions[0];
          let defUri: vscode.Uri;
          let defRange: vscode.Range;

          if ("uri" in def) {
            // It's a Location
            defUri = def.uri;
            defRange = def.range;
          } else {
            // It's a LocationLink
            defUri = def.targetUri;
            defRange = def.targetSelectionRange || def.targetRange;
          }

          // Create item pointing to the REAL definition
          definitionItem = new vscode.CallHierarchyItem(
            vscode.SymbolKind.Function,
            calleeName,
            "",
            defUri,
            defRange,
            defRange
          );
        }
      } catch (e) {
        // Fallback if definition provider fails or Python extension is missing
        console.log("Definition provider failed, falling back to simple regex:", e);
      }

      // Fallback: assume it's in the current file (same behavior as before)
      if (!definitionItem) {
        definitionItem = new vscode.CallHierarchyItem(
          vscode.SymbolKind.Function,
          calleeName,
          "",
          item.uri,
          range,
          range
        );
      }

      results.push(new vscode.CallHierarchyOutgoingCall(definitionItem, [range]));
    }

    return results;
  },
};

export async function analyzeCallHierarchy(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel
) {
  // This function is mostly for debugging via command, similar logic as extension.ts
  output.show(true);
  try {
    output.appendLine("🚀 Command started (Debug Analyzer)");
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage("Open a Python file first.");
      return;
    }

    output.appendLine(`📄 File: ${editor.document.fileName}`);
    const result = await getCallHierarchyAt(editor.document, editor.selection.active);

    if (!result) {
      output.appendLine("❌ No hierarchy found.");
      return;
    }

    output.appendLine("✅ Analysis successful. Result:");
    output.appendLine(JSON.stringify(result, null, 2));
  } catch (error) {
    output.appendLine(`❌ Error: ${error}`);
  }
}
