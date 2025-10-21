# Python samples for Call Hierarchy Demo

This folder contains small Python programs to test various call-hierarchy scenarios (incoming, outgoing, branching, loops, recursion, classes, and edge cases).

## Files

- `math_utils.py`
  - `helper(x)`
  - `add(a, b)` → calls `helper`
  - `mul(a, b)` → calls `helper`

- `app.py`
  - `choose_op(a, b, op)` → uses `if/elif/else` to call `add` or `mul` (or neither)
  - `run()` → calls `choose_op` with different `op` values

- `branching.py`
  - `pick_max(a, b)` → calls `helper_branch` in both branches
  - `helper_branch(x)` → simple passthrough

- `loops.py`
  - `sum_for(n)` → calls `add_one` inside a for-loop
  - `sum_while(n)` → calls `add_one` inside a while-loop
  - `add_one(x)` → helper

- `recursion.py`
  - `factorial(n)` → recursive call to itself
  - `mutual_a(n)` ↔ `mutual_b(n)` → mutual recursion

- `classes.py`
  - `Greeter.greet()` → calls its own `_format` method
  - `use_greeter()` → constructs `Greeter` and calls `greet`

- `module_level.py`
  - `on_import()` is called at module import time (module-level call)

- `edge_cases.py`
  - `no_body()`
  - `calls_builtins()` → calls built-in functions `print`, `len`
  - `nested_functions()` → inner function + call
  - `same_name()` → local function and variable name shadowing

## Try it

1. Open any of the files above in VS Code.
2. Put the cursor on a function name.
3. Run the command: "Show Call Hierarchy" (Cmd/Ctrl+Shift+H).
4. Inspect `.vscode/callHierarchy.json` for incoming/outgoing calls.

### Suggested Scenarios

- On `app.py` → `choose_op`: See outgoing calls depending on branches (add/mul/none).
- On `math_utils.py` → `helper`: See incoming calls from `add` and `mul`.
- On `loops.py` → `sum_for` or `sum_while`: See outgoing calls to `add_one` inside loops.
- On `recursion.py` → `factorial`: Outgoing includes a self-call (filtered from incoming by the extension).
- On `recursion.py` → `mutual_a`/`mutual_b`: Each should have outgoing to the other.
- On `classes.py` → `Greeter.greet`: Outgoing to `_format`.
- On `module_level.py` → `on_import`: Incoming from module-level assignment `value = on_import()`.
- On `edge_cases.py` → `calls_builtins`: Outgoing to built-ins may or may not be included depending on regex matching; still useful to ensure no crashes.

The extension writes `.vscode/callHierarchy.json` with workspace-relative paths.
