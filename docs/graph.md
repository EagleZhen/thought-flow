# Graph Visualization

Interactive call graph visualization using Cytoscape.js in a VS Code webview panel.

## Architecture

```
analyzer.ts          graph.ts               Webview (graphScript.js)
    |                   |                            |
    |--Call Hierarchy-->|                            |
    |                   |--Transform to Cytoscape--->|
    |                   |   (nodes + edges)          |
    |                   |                            |
    |                   |<--NODE_TAPPED message------|
    |                   |                            |
    |<--Get hierarchy---|                            |
    |   at tapped node  |                            |
    |                   |                            |
    |--New hierarchy--->|--ADD_ELEMENTS message----->|
    |                   |                            |
    |                   |                 (updates graph)
```

## Implementation

**Files:**

- [extension/src/graph.ts](../extension/src/graph.ts) - Graph transformation and webview setup
- [extension/src/templates/graphScript.js](../extension/src/templates/graphScript.js) - Cytoscape.js initialization and interaction
- [extension/src/templates/graphView.html](../extension/src/templates/graphView.html) - Webview HTML structure
- [extension/src/templates/graphStyle.css](../extension/src/templates/graphStyle.css) - Visual styling

## Data Transformation

### Input: Call Hierarchy

From [analyzer.ts](../extension/src/analyzer.ts):

```typescript
interface CallHierarchy {
  target: FunctionCall; // Focused function
  incoming: FunctionCall[]; // Functions that call target
  outgoing: FunctionCall[]; // Functions called by target
}

interface FunctionCall {
  name: string; // Function name
  filePath: string; // Relative path
  line: number; // 1-based line number
}
```

### Output: Cytoscape Graph

```typescript
interface CytoscapeGraph {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

interface CytoscapeNode {
  data: { id: string; label: string };
}

interface CytoscapeEdge {
  data: { id?: string; source: string; target: string };
}
```

**Node ID format:** `{name} @ {filePath}:{line}` (e.g., `calculate @ calculator/core.py:42`)

**Encoding:** IDs are URL-encoded before sending to webview to handle special characters.

## Graph Layout

**Algorithm:** `cose` - Force-directed layout with physics simulation

**Initial layout configuration:**

```javascript
{
  name: "cose",
  animate: true,
  animationDuration: 800,
  refresh: 20,
  fit: true,
  padding: 50,
  nodeRepulsion: 10000,
  idealEdgeLength: 80,
  componentSpacing: 60,
  gravity: 1.5,
  numIter: 1000
}
```

**On expansion** (different settings):

- `animationDuration: 600` (faster)
- `gravity: 1.2` (lighter pull)
- `fit: false` (don't re-center)

## Visual Styling

- vee-shaped arrows (`target-arrow-shape: "vee"`)
- 40% opacity
- CSS transitions defined in JavaScript style config (not graphStyle.css)

- **Gold (#d9a40e)** - Target node (focused function)
- **Blue (#4376c2)** - User-defined functions
- **Gray (#9e9e9e)** - System/built-in functions (e.g., `print`, `<module>`)

**Edge styling:**

- Bezier curves with vee-shaped arrows
- 40% opacity (reduces visual clutter)
- Hover effects via CSS transitions

## Interactive Features

### Node Click

1. User clicks node in graph
2. Webview sends `NODE_TAPPED` message to extension
3. Extension:
   - Parses node ID to extract file path and line number
   - Opens document at that location
   - Calls analyzer to get hierarchy for clicked function
   - Transforms new hierarchy to Cytoscape format
4. Extension sends `ADD_ELEMENTS` message back to webview
5. Webview filters duplicates and adds new nodes/edges
6. Layout re-runs with smooth animation

### Expansion Strategy

**Incremental:** Only adds new nodes on click (doesn't rebuild entire graph)

**Duplicate prevention:**

```javascript
const newNodes = message.data.nodes.filter((n) => cy.getElementById(n.data.id).empty());
```

**Layout stability:** Uses `fit: false` on expansion to avoid jarring zoom changes.

## Webview Setup

**Security:**

- `enableScripts: true` - Required for Cytoscape.js
- `localResourceRoots` - Restricts file access to `dist/templates/`

**Resource URIs:**

```typescript
const cssUri = panel.webview.asWebviewUri(
  vscode.Uri.joinPath(context.extensionUri, "dist", "templates", "graphStyle.css")
);
```

VS Code automatically handles webview security.

## Message Protocol

**Extension → Webview:**

```typescript
// Initial graph
{
  type: "INIT_GRAPH",
  data: CytoscapeGraph,    // Encoded nodes + edges
  targetId: string          // Encoded target node ID
}

// Add elements after node click
{
  type: "ADD_ELEMENTS",
  data: CytoscapeGraph     // New nodes + edges to add
}
```

**Webview → Extension:**

```typescript
{
  type: "NODE_TAPPED",
  payload: { id: string }  // Encoded node ID
}
```

## Key Design Decisions

| Decision                         | Rationale                                              |
| -------------------------------- | ------------------------------------------------------ |
| **`cose` layout**                | Force-directed layout handles variable graph sizes     |
| **Incremental expansion**        | Avoids overwhelming UI with full call graph at once    |
| **ID encoding**                  | Handles special chars in file paths/function names     |
| **Dim system functions**         | Reduces noise from built-ins like `print`              |
| **Webview vs custom editor**     | Webview simpler for interactive visualization          |
| **Message-based communication**  | Clean separation between graph logic and visualization |
| **Different expansion settings** | Faster animation, no re-centering on node click        |

## Limitations

- **No filtering UI** - All nodes shown once added (no hide/collapse)
- **No persistence** - Graph resets when panel closes
