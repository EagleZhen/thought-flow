# analyzer.ts - Code Logic & Flow

## Overview

`analyzer.ts` implements a custom Call Hierarchy for Python using VS Code commands plus lightweight regex and indentation heuristics to produce:

- Incoming calls (who calls a function)
- Outgoing calls (what a function calls)

It also writes a summarized `callHierarchy.json` under `.vscode/` for the active workspace.

---

## Core Entry Points

- `getCallHierarchyAt(document, position)` → `Promise<{ function, callers, callees } | null>`
- `analyzeCallHierarchy(context, output)` → `Promise<CallHierarchy | undefined>`

### `getCallHierarchyAt` Flow

1. Detect if the cursor is on a function definition (`isCursorOnDefinition`).
2. Prepare a `CallHierarchyItem` at the cursor via `vscode.prepareCallHierarchy`.
3. If none returned, log and return `null`.
4. If on the definition: ask providers for incoming and outgoing calls directly using the prepared item.
5. If not on the definition:
   - Ask providers for outgoing calls using the prepared item (so users can still inspect what the symbol under cursor calls).
   - For incoming calls, find the nearest enclosing `def` with `findNearestDefinitionCallHierarchyItem`:
     - If found, call the custom provider directly for that definition (bypassing language providers to avoid "invalid item" errors).
     - If no enclosing def found, return an empty incoming calls array (do not query language providers).
   - Add a synthetic incoming call from the definition to the clicked call site when:
     - The click is in the same document as the definition
     - The position is inside the function body (position line > def line)
     - There isn't already an incoming entry from the same function
     - When inside the function body, show ONLY the synthetic incoming (the definition itself), removing external callers.
6. Return `{ function, callers, callees }`.

### `analyzeCallHierarchy` Flow

1. Show the output channel and log "Command started".
2. If no active editor, show an info message and return `undefined`.
3. Log the file name and cursor position to the output channel.
4. Invoke `getCallHierarchyAt`; if it returns `null`, show an info message and return `undefined`.
5. Build a workspace-relative `CallHierarchy` object (1-indexed lines for display).
6. If workspace folder exists:
   - Create `.vscode` directory if needed
   - Write `.vscode/callHierarchy.json` with the analyzed data
   - Log success to output channel, notify user, and open the file
7. If no workspace folder exists, show a warning and skip file creation.
8. Log "--- Complete ---" and return the analyzed data.
9. Errors are logged to output channel, shown to user via error message, and rethrown.

---

## Custom Provider Pieces

### `prepareCallHierarchy`

- Gets the word at cursor; returns `undefined` if none.
- If the current line matches `def <name>(` for that word, returns a `CallHierarchyItem` for the definition.
- Otherwise returns a `CallHierarchyItem` for the word at cursor (could be a call site, variable, or any symbol).

### `provideCallHierarchyIncomingCalls`

- Scans all `**/*.py` files (excluding `node_modules`).
- Regex: `\b<targetName>\s*\(`; skips `def <targetName>(` lines.
- For each call site found, uses `findNearestDefinitionCallHierarchyItem` to determine the enclosing function.
- If no enclosing function is found, marks the caller as `<module>` (module-level code).
- Skips self-recursive callers (when the enclosing function has the same name as the target).

### `provideCallHierarchyOutgoingCalls`

- This part is just for later custom development on outgoing calls.
- Locates the function definition line using regex `^\s*def\s+<name>\s*\(`.
- If the initial line (from `item.selectionRange`) is not a definition line, searches upward first, then searches the entire document if needed.
- Determines the function body boundaries using Python's indentation rules:
  - Gets the indentation of the `def` line
  - Finds the first non-blank line after the definition (the body start)
  - The body indent must be greater than the def indent
  - The body ends when a line with indentation less than the body indent is encountered
- Extracts the body text between body start and body end.
- Regex: `\b([A-Za-z_][A-Za-z0-9_]*)\s*\(` to collect all function calls in the body.
- Skips self-recursive calls.
- Returns each match as a `CallHierarchyOutgoingCall` with its range in the body.

---

### `isCursorOnDefinition`

- Determines whether the cursor is positioned on a Python function definition line.
- Strategy:
  1. Gets the word at cursor position; returns `false` if none.
  2. Quick line-based detection: tests if the current line matches `^\s*def\s+<name>\s*\(` for that word.
  3. If quick detection passes, returns `true`.
  4. Fallback: calls `vscode.prepareCallHierarchy` to let language providers participate, then checks if the returned item's selectionRange line contains a `def` for the same name.
  5. Returns `false` if any step fails or no definition is found.

### `findNearestDefinitionCallHierarchyItem`

- Purpose: walk upward from a position to find the nearest enclosing `def` with less indentation than the current line, returning a `CallHierarchyItem` for that definition.
- How it works:
  1. Starts with the indentation of the clicked line as `currentIndent`.
  2. Walks upward line by line from `position.line - 1`.
  3. Skips blank lines (lines with no text after trimming).
  4. Ignores lines with indentation >= `currentIndent` (same level or deeper).
  5. When a line with indentation < `currentIndent` is encountered:
     - Tests it against `^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(`.
     - If it's a `def`, creates and returns a `CallHierarchyItem` for that function.
     - If not a `def`, lowers `currentIndent` to that line's indentation and continues searching.
  6. Stops if `currentIndent` reaches 0 (top-level) and no def is found.
  7. Returns `undefined` if no enclosing function is found.
- Uses:
  - Map incoming call sites to their containing function in `provideCallHierarchyIncomingCalls`.
  - Find the enclosing function when cursor is not on a definition in `getCallHierarchyAt`.
  - Powers the synthetic incoming edge logic when the cursor is inside a function body.

---

## Helper

- `escapeRegExp(str)`: escapes regex metacharacters (`[.*+?^${}()|[\]\\]`) by prefixing them with backslashes; used in both incoming/outgoing regex construction and definition pattern matching.

---

## Behavior and Types

- `getCallHierarchyAt` returns `null` when no symbol is prepared at the cursor position; otherwise returns an object with `{ function, callers, callees }`.
- When cursor is not on a definition and no enclosing function is found, incoming calls will be an empty array (does not query language providers in this case).
- When cursor is inside a function body (not on the definition line), only the synthetic incoming call (the definition itself) is shown; external callers are filtered out.
- `analyzeCallHierarchy` returns `CallHierarchy | undefined`:
  - Returns `undefined` for early exits (no active editor, no symbol found, no workspace folder).
  - Returns the `CallHierarchy` object when successful.
  - Errors are logged to the output channel, shown to the user via error message, and rethrown.
- JSON output is written to `.vscode/callHierarchy.json` with workspace-relative paths and 1-indexed lines for display.

---

## Limitations (current implementation)

- Regex-based; may include false positives (e.g., names inside strings/comments).
- No alias/import resolution; `y()` will not be tied to `from x import y as z`.
- Does not distinguish methods (`self.foo`) vs free functions.
- Outgoing analysis uses indentation-based body detection, which may fail on malformed Python code.
- The `provideCallHierarchyOutgoingCalls` searches for the definition line if not initially on one, first upward then through the entire document if needed.

---

## Summary

Call graph nodes and edges are built from:

- **Incoming**: workspace regex scan + nearest enclosing `def` resolution
- **Outgoing**: function-body regex scan + indentation boundaries
