# Python Call Hierarchy Demo

A VS Code extension that analyzes and exports Python function call hierarchies to JSON format.

## Features

- **Analyze Python Call Relationships**: Place your cursor on any Python function/method and get a complete analysis of:
  - **Incoming calls**: Which functions call this function
  - **Outgoing calls**: Which functions this function calls
- **JSON Export**: Automatically saves the call hierarchy to `.vscode/callHierarchy.json`
- **Workspace-relative paths**: All file paths are relative to your workspace for portability
- **Custom Call Hierarchy Provider**: Includes a regex-based provider for Python files

## Usage

1. Open a Python file in VS Code
2. Place your cursor on a function or method name
3. Trigger the analysis using one of these methods:
   - **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`): Type "Show Python Call Hierarchy"
   - **Keyboard Shortcut**: `Cmd+Shift+H` (Mac) or `Ctrl+Shift+H` (Windows/Linux)
   - **Right-click Context Menu**: Select "Show Python Call Hierarchy"

The extension will analyze the call hierarchy and save the results to `.vscode/callHierarchy.json` in your workspace.

## Output Format

The generated JSON file includes:

```json
{
  "function": "function_name",
  "current_file": "relative/path/to/file.py",
  "line": 10,
  "incoming": [
    {
      "from": "caller_function",
      "file_path": "relative/path/to/caller.py",
      "line": 5
    }
  ],
  "outgoing": [
    {
      "to": "called_function",
      "file_path": "relative/path/to/called.py",
      "line": 20
    }
  ]
}
```

## Requirements

- VS Code version 1.85.0 or higher
- Python extension for VS Code (for best results with language server features)

## How It Works

The extension uses two approaches to analyze Python call hierarchies:

1. **VS Code's Built-in Call Hierarchy API**: Uses the language server protocol to get accurate call hierarchy information
2. **Custom Regex-based Provider**: A fallback provider that scans Python files using regex patterns to find function calls

### Python Function Body Detection

The extension identifies function bodies using Python's indentation rules:
- Finds the function definition line
- Measures the indentation of the first line in the body
- Continues until it finds a line with less indentation
- All lines with equal or greater indentation are considered part of the function body

## Known Limitations

- The regex-based provider is simple and may not catch all edge cases (e.g., calls within strings, comments)
- Multi-line function calls may not be detected accurately
- Dynamic function calls (e.g., `getattr()`, `exec()`) are not analyzed

## Development

To run the extension in development mode:

1. Clone the repository
2. Run `npm install` to install dependencies
3. Press `F5` to launch the Extension Development Host
4. Open a Python file and test the extension

To compile: `npm run compile`

## Release Notes

### 0.0.1

Initial release:
- Python call hierarchy analysis
- JSON export functionality
- Custom call hierarchy provider
- Keyboard shortcuts and context menu integration

---

**Enjoy analyzing your Python code!**
