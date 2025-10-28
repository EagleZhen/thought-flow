# ThoughtFlow

A VS Code extension that helps developers understand complex codebases by visualizing code execution paths as explorable mind maps.

## Overview

ThoughtFlow analyzes Python code and generates interactive call graphs, making it easier to trace execution flow and understand how functions interact.

## Project Structure

- `docs/` - Documentation
- `experiments/` - Sandbox for prototyping new approaches
- `extension/` - VS Code extension (TypeScript)
  - `src/` - Source code (supports `@/*` path aliases)
    - `extension.ts` - Extension activation, command registration, orchestration
    - `analyzer.ts` - Code analysis using VS Code LSP
    - `graph.ts` - Graph visualization with Cytoscape.js
    - `license.ts` - User and license management
    - `types.ts` - Shared type definitions
    - `templates/` - HTML/CSS/JS templates for webview
  - `dist/` - Production build output (Webpack)
  - `out/` - Development build output (tests)
- `license-service/` - Backend API for user and license management (to be implemented)
- `llm-service/` - Optional LLM integration (future)
- `test-workspace/` - Sample Python projects for testing the extension

## Getting Started

**Prerequisites:** VS Code, Node.js

**Setup:**

1. Clone and open in VS Code
2. Install dependencies: `cd extension && npm install`
3. Press `F5` → Select **"VS Code Extension Development"**
4. In the new Extension Development Host window, open a Python project (or use `test-workspace/`)
5. Click on a function, then run:
   - `Cmd+Shift+A` / `Ctrl+Shift+A` → **Test Analyzer** (backend only)
   - `Cmd+Shift+G` / `Ctrl+Shift+G` → **Test Graph** (frontend only)
   - Command Palette → **"ThoughtFlow: Visualize Call Graph"** (full flow, no keybinding yet)
6. View logs: **View** → **Output** → Select **"ThoughtFlow"** from dropdown

Code auto-formats on save (Prettier for TS/JS). Feel free to mess with the codes in `experiments/test-formatting/`.

## Course Project

This is a course project for CSCI3100 Software Engineering. AI tools are used in development and properly acknowledged per academic integrity requirements. See [docs/AI_USAGE.md](docs/AI_USAGE.md) for details.
