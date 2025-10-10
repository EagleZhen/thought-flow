## 7 Oct Update
### Current function

Visualize code structures by fetching graph data from a local Python backend and rendering it as an interactive graph using Cytoscape.js

* UI to Backend:
  `GET` request to the backend API endpoint with no parameters.
  Endpoint:`http://127.0.0.1:5000/api/graph`
* Backend to UI:
  **Must** respond in the following format:
  ` { "elements": [ { "data": { "id": "A", "label": "A" } }, { "data": { "id": "B", "label": "B" } }, { "data": { "source": "A", "target": "B" } } ] }`

### Dependencies

### Notes

* python is use to process adj lists in consideration of later connection to earlier operations
* other dependencies for python scripts should be included in graphdata/.venv/lib/site-packages in order for command in extension.ts to use

### How to run

* Node.js with npm
* Open project in vscode, press F5 to run. Then, press Ctrl+Shift+P, choose command "Run Code Graph" to run
* Expected to see the graph

### Ref
Extension Guides from vscode
`https://code.visualstudio.com/api/extension-guides/overview`
