## 17 Oct Update

* extension.ts: line 1 - line 59 includes analysing callHierarchy.json and outputting "elements" as an input string for cytoscape.js
* replace everything after line 54 with latest UI stuff; use ${ elements } as input for initializeCytoscape()

## 11 Oct Update

This VS Code extension visualizes code structures by executing a local Python script to generate graph data. The data is then rendered as an interactive graph within a VS Code webview panel using Cytoscape.js.

- **UI to Backend Communication**:
  Instead of an HTTP request, the extension now directly executes the Python script (`/graphdata/graphdata.py`) as a child process.

- **Backend to UI Data Format**:
  The Python script outputs a standard JSON string to `stdout`. The expected format is an object containing `nodes` and `edges` arrays, which is then parsed by the frontend:
  ```json
  {
    "nodes": [
      { "data": { "id": "A", "label": "A", "parent": "Group1" } },
      { "data": { "id": "Group1", "label": "Group1" } }
    ],
    "edges": [{ "data": { "source": "A", "target": "B" } }]
  }
  ```

### How to Run

A detailed guide to get the extension running in a development environment.

**Prerequisites:**

- [Node.js](https://nodejs.org/) (with npm)
- [Python](https://www.python.org/) (>=3.12 recommended)
- [Visual Studio Code](https://code.visualstudio.com/)

**Steps**

```
cd /path/to/thought-flow/extension
npm install
# Navigate to the graphdata directory
cd graphdata

# Create a virtual environment named .venv
python3 -m venv .venv

# Activate the virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# No dependencies are needed for the current version.

# Deactivate and return to the extension directory
deactivate
cd ..
npm run compile
# Open the **root `thought-flow` folder** in VS Code.
# Press `F5` to start a new debugging session. This will open a new "Extension Development Host" window.
# In the new window, press `Cmd+Shift+P` (macOS) or `Ctrl+Shift+P` (Windows) to open the Command Palette.
# Type and select the **`Run Code Graph`** command.
```

## 7 Oct Update

### Current function

Visualize code structures by fetching graph data from a local Python backend and rendering it as an interactive graph using Cytoscape.js

- UI to Backend:
  `GET` request to the backend API endpoint with no parameters.
  Endpoint:`http://127.0.0.1:5000/api/graph`
- Backend to UI:
  **Must** respond in the following format:
  ` { "elements": [ { "data": { "id": "A", "label": "A" } }, { "data": { "id": "B", "label": "B" } }, { "data": { "source": "A", "target": "B" } } ] }`

### Dependencies

### Notes

- python is use to process adj lists in consideration of later connection to earlier operations
- other dependencies for python scripts should be included in graphdata/.venv/lib/site-packages in order for command in extension.ts to use

### How to run

- Node.js with npm
- Open project in vscode, press F5 to run. Then, press Ctrl+Shift+P, choose command "Run Code Graph" to run
- Expected to see the graph

### Ref

Extension Guides from vscode
`https://code.visualstudio.com/api/extension-guides/overview`
iVis-at-Bilkent/cytoscape.js-view-utilities
`https://github.com/iVis-at-Bilkent/cytoscape.js-view-utilities`
