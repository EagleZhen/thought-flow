# ThoughtFlow

A VS Code extension that helps developers understand complex codebases by visualizing code execution paths as explorable mind maps.

## Overview

ThoughtFlow analyzes Python code and generates interactive call graphs, making it easier to trace execution flow and understand how functions interact.

## Getting Started

**Prerequisites:** VS Code, Node.js

**Setup:**

1. Clone and open in VS Code
2. Install dependencies: `cd extension && npm install`
3. Start watch mode: `cd extension && npm run watch` (keep running in terminal)
4. Press `F5` → Select **"VS Code Extension Development"**
5. In the new Extension Development Host window, open a Python project (or use `test-workspace/`)

**Development:**

- Edit code → Save (webpack auto-recompiles)
- Press `Cmd+R` / `Ctrl+R` in Extension Development Host to reload
- Click on a function, then run:
  - `Cmd+Shift+A` / `Ctrl+Shift+A` → **Test Analyzer**
  - `Cmd+Shift+G` / `Ctrl+Shift+G` → **Test Graph**
  - Command Palette → **"ThoughtFlow: Visualize Call Graph"** (full integration)
- View logs: **View** → **Output** → Select **"ThoughtFlow"**

Code auto-formats on save (Prettier for TS/JS). Feel free to mess with the codes in `experiments/test-formatting/`.

## Course Project

This is a course project for CSCI3100 Software Engineering. AI tools are used in development and properly acknowledged per academic integrity requirements. See [docs/AI_USAGE.md](docs/AI_USAGE.md) for details.
