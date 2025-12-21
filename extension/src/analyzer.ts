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

    // Ensure we return arrays, not null/undefined, to satisfy Strict types in other files
    return {
      function: resultFunctionItem,
      callers: incomingCalls ?? [],
      callees: outgoingCalls ?? [],
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
 * Determine whether the cursor is positioned on a Python function definition.
 *
 * Strategy:
 * 1. Check the word at the cursor and test the current line against a
 * `def <name>(` pattern.
 * 2. If that fails, fall back to `vscode.prepareCallHierarchy` (so other
 * language providers can participate) and verify the returned item's
 * selectionRange line contains a `def` for the same name.
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

      // ============================================================
      // STEP 1: Find all calls to the target function using regex
      // (We no longer pre-build a defs map; instead we use
      // findNearestDefinitionCallHierarchyItem to resolve the caller)
      // ============================================================
      // Pattern: word boundary + target name + optional whitespace + "("
      // Example: "foo(" or "foo (" or "result = foo("
      const callRegex = new RegExp("\\b" + escapeRegExp(targetName) + "\\s*\\(", "g");
      const defLinePattern = new RegExp("^\\s*def\\s+" + escapeRegExp(targetName) + "\\s*\\(");

      let match: RegExpExecArray | null;

      while ((match = callRegex.exec(text)) !== null) {
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
): Promise<CallHierarchy | undefined> {
  output.show(true); // Show the panel immediately when extension activates

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
      incoming: (result.callers ?? []).map((caller) => ({
        name: caller.from.name,
        filePath: toRel(caller.from.uri),
        line: caller.from.selectionRange.start.line + 1,
      })),
      outgoing: (result.callees ?? []).map((callee) => ({
        name: callee.to.name,
        filePath: toRel(callee.to.uri),
        line: callee.fromRanges[0].start.line + 1,
      })),
    };

    // ============================================================
    // STEP 5: Save to .vscode/callHierarchy.json
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
      // STEP 6: Notify user and open the file
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
    return analyzedData;
  } catch (error) {
    // ============================================================
    // Handle any errors that occur during execution
    // ============================================================
    const msg = `Error: ${error}`;
    output.appendLine(msg);
    vscode.window.showErrorMessage(msg);
    throw error;
  }
}
