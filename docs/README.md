# ThoughtFlow Documentation

Welcome to the ThoughtFlow technical documentation! This directory contains detailed guides for understanding and working with the codebase.

## What is ThoughtFlow?

ThoughtFlow is a VS Code extension that visualizes Python code execution flow as interactive call graphs. It helps developers understand complex codebases by showing how functions call each other, with an intuitive click-to-expand graph interface.

## Architecture Overview

The project consists of two main components:

### 1. **VS Code Extension** (`/extension`)

- **Analyzer** ([analyzer.md](analyzer.md)) - Custom Python call hierarchy engine using VS Code APIs
- **Graph Visualization** - Interactive Cytoscape.js graph in a webview panel
- **License Management** - GitHub OAuth integration with tier-based feature access

### 2. **Backend API** (`/backend`)

- **Serverless Functions** ([backend.md](backend.md)) - Vercel-hosted API for license management
- **Firebase Integration** - User accounts and license key storage in Firestore
- **GitHub Authentication** - Token verification and user identity management

## Project Structure

```
thought-flow/
├── extension/               # VS Code Extension
│   ├── src/
│   │   ├── extension.ts     # Main entry point, command registration
│   │   ├── analyzer.ts      # Call hierarchy analysis engine
│   │   ├── graph.ts         # Graph visualization logic
│   │   ├── license.ts       # Auth & license management
│   │   ├── types.ts         # TypeScript type definitions
│   │   └── templates/       # Webview HTML/CSS/JS
│   ├── package.json         # Extension manifest & dependencies
│   └── webpack.config.js    # Build configuration
│
├── backend/                 # Vercel Serverless API
│   ├── api/
│   │   ├── index.ts         # Main API endpoint handler
│   │   └── firebase.ts      # Firestore database operations
│   └── package.json         # Backend dependencies
│
├── docs/                    # Technical documentation
│   ├── analyzer.md          # Call hierarchy implementation
│   ├── graph.md             # Graph visualization system
│   ├── license.md           # Authentication & licensing
│   ├── backend.md           # API & database architecture
│   └── AI_USAGE.md          # AI assistance disclosure
│
└── test-workspace/          # Sample Python project for testing
```

For installation, features, and usage instructions, see the [main project README](../README.md).
