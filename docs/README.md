# Technical Documentation of ThoughtFlow

This directory contains the detailed technical documentation for understanding and working with the codebase.

## Architecture Overview

The project consists of two main components:

### 1. **VS Code Extension** (`/extension`)

- **Analyzer** ([analyzer.md](analyzer.md)) - Custom Python call hierarchy engine with dual-path analysis (on definition vs. inside function)
- **Graph Visualization** ([graph.md](graph.md)) - Interactive Cytoscape.js graph with incremental expansion and bidirectional navigation
- **License Management** ([license.md](license.md)) - GitHub OAuth integration with client-side state management and tier-based feature access

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
