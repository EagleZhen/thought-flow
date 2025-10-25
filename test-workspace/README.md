# Test Workspace - Calculator

Minimal Python project for testing ThoughtFlow call hierarchy visualization.

Covers key scenarios: entry points, cross-file imports, recursion, and leaf functions.

## Project Structure

```
test-workspace/
├── main.py         # Entry point, call other modules in the calculator package
└── calculator/
    ├── core.py     # Recursion, call another module at the same level
    └── utils.py    # Leaf functions, only incoming calls, no outgoing calls
```
