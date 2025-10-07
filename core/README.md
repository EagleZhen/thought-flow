# Core

Core analysis logic for ThoughtFlow, written in TypeScript.

## Components

- `analyzer/` - Code analysis using VS Code's language server APIs
- `query/` - Path selection, filtering, and graph expansion logic
- `types/` - Shared data structures and type definitions

## Purpose

Contains the main business logic for analyzing Python code and building call graphs. Used directly by the extension (same process, imported as modules).
