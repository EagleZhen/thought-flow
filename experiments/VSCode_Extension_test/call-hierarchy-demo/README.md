## Call Hierarchy Demo

Call Hierarchy Demo is a small Visual Studio Code extension that analyzes the call hierarchy for a symbol in the active editor and saves the result to a JSON file. It's intended as a compact demo of using the VS Code extension API to inspect call relationships and export them for analysis or tooling.

Key points:

- Command: `callHierarchyDemo.showCallHierarchy`
- Default keybinding: Ctrl+Shift+H (Cmd+Shift+H on macOS)
- Context menu entry in the editor for TypeScript and Python files

---

## Features

- Inspect call hierarchy for the symbol under the cursor.
- Export the discovered call graph to a JSON file in the workspace (file name: `callHierarchy.json`).
- Quick access from the Command Palette, editor context menu (TypeScript/Python), or the default keybinding.

## Requirements

- Visual Studio Code compatible with API version ^1.85.0 (see `package.json`).
- No additional external dependencies are required to use the extension.

## Installation

Install from the VS Code Marketplace (when published) or run locally during development:

1. Clone this repository.
2. Install dependencies:

```powershell
npm install
```

3. Build the extension:

```powershell
npm run compile
```

4. Launch the extension for development: open this folder in VS Code, press F5 (Run Extension) to open a new Extension Development Host window.

## Usage

- Open a Python file in the editor.
- Place the cursor on a function / method / symbol you want to analyze.
- Run the command from the Command Palette: `> Show Call Hierarchy` (or use the keybinding `Ctrl+Shift+H`).
- Alternatively, right-click in the editor and choose `Show Call Hierarchy` from the context menu (appears for TypeScript and Python files).
- After the analysis finishes a JSON file will be created in the workspace root with a name like `callHierarchy.json` containing the exported call structure.

Example JSON shape (simplified):

```json
{
  "function": "choose_op",
  "current_file": "app.py",
  "line": 20,
  "incoming": [
    {
      "from": "run",
      "caller_line": 18,
      "file_path": "app.py",
      "line": 20
    },
    {
      "from": "run",
      "caller_line": 18,
      "file_path": "app.py",
      "line": 21
    },
    {
      "from": "run",
      "caller_line": 18,
      "file_path": "app.py",
      "line": 22
    }
  ],
  "outgoing": [
    {
      "to": "add",
      "file_path": "app.py",
      "line": 10
    },
    {
      "to": "mul",
      "file_path": "app.py",
      "line": 12
    }
  ]
}
```

Where `caller_line` is the line of starting position of caller and `line` is the exact location where the clicked function is called

## Development

- Useful npm scripts (see `package.json`):

	- `npm run compile` — compile TypeScript sources to `out/`.

- Debugging in VS Code:

	1. Press F5 to open the Extension Development Host.
	2. Use the Run view to attach breakpoints in `src/` and inspect behavior.
