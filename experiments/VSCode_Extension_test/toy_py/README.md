# Python sample for Call Hierarchy Demo

This folder provides a minimal Python codebase to exercise the extension's call-hierarchy support.

## Files
- `math_utils.py`:
  - `helper(x)` is a simple function.
  - `add(a, b)` and `mul(a, b)` both call `helper(...)` so they have outgoing edges.
- `app.py`:
  - `run()` calls `add` and `mul`, providing incoming edges for both.

## Try it
1. Open `app.py`.
2. Place the cursor on `run` and run "Show Call Hierarchy" to see its outgoing calls to `add` and `mul`.
3. Open `math_utils.py` and place the cursor on `helper`, `add`, or `mul`.
   - On `helper`: run the command to see incoming calls from `add` and `mul`.
   - On `add` or `mul`: run the command to see outgoing calls to `helper` and incoming calls from `run`.

The extension writes `.vscode/callHierarchy.json` with workspace-relative paths.
