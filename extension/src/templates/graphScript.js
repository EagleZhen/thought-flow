// Path: extension/src/templates/graphScript.js

const vscode = acquireVsCodeApi();

// Define cy at the top level so all functions can access it
let cy;

/**
 * Helper function to apply 'expandable' class to nodes that have hidden neighbors.
 * @param {cytoscape.Collection} nodes - The nodes to check.
 */
function updateExpandableNodes(nodes) {
  // We will implement this later when we have real multi-level data
}

/**
 * Initializes the Cytoscape graph with the provided data.
 * @param {object} graphData - The graph data object { nodes: [...], edges: [...] }
 * @param {string} targetNodeId - The ID of the node that the user clicked on.
 */
function initializeCytoscape(graphData, targetNodeId) {
  console.log("Initializing graph with data:", graphData);
  console.log("Target Node ID received:", targetNodeId);

  const elements =
    graphData && Array.isArray(graphData.nodes) && Array.isArray(graphData.edges)
      ? [...graphData.nodes, ...graphData.edges]
      : graphData;

  if (!elements || !Array.isArray(elements)) {
    console.error("Invalid graph data format received:", graphData);
    document.body.innerHTML =
      '<p style="color: red; padding: 10px;">Error: Invalid graph data format.</p>';
    return;
  }

  const targetNodeSelector = `node[id = "${targetNodeId}"]`;
  console.log("Using selector for target node:", targetNodeSelector);

  try {
    // Assign to the top-level 'cy' variable
    cy = cytoscape({
      container: document.getElementById("cy"),
      elements: elements,
      style: [
        {
          selector: "node", // Default node style
          style: {
            "background-color": "#4376c2",
            label: "data(label)",
            color: "#000000",
            shape: "rectangle",
            "font-family": "Consolas",
            "transition-property": "background-color, border-color, border-width, border-style",
            "transition-duration": "0.2s",
          },
        },
        {
          selector: targetNodeSelector, // Style for our Target Node
          style: {
            "background-color": "#d9a40e",
            "border-color": "#FFF",
            "border-width": 2,
            color: "#000000",
            "z-index": 10,
          },
        },
        {
          // Style for nodes that can be expanded
          selector: "node.expandable",
          style: {
            "border-color": "#e63946",
            "border-width": 3,
            "border-style": "dashed",
          },
        },
        {
          selector: "edge", // Default edge style
          style: {
            width: 3,
            "line-color": "#7a96c0",
            "target-arrow-color": "#7a96c0",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            opacity: 0.5,
          },
        },
      ],
      layout: {
        name: "cose",
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0,
      },
    });

    // --- Interactivity ---

    // When a node is tapped...
    cy.on("tap", "node", function (evt) {
      const node = evt.target;
      const nodeId = node.id(); // Get the ID (it's already encoded)
      console.log("Tapped node id: " + nodeId + ", label: " + node.data("label"));

      // Send a message BACK to the extension, requesting to expand this node.
      vscode.postMessage({
        type: "NODE_TAPPED",
        payload: {
          id: decodeURIComponent(nodeId), // Send the clean, un-encoded ID
        },
      });
    });

    cy.on("tap", "edge", function (evt) {
      const edge = evt.target;
      console.log("Tapped edge from " + edge.source().id() + " to " + edge.target().id());
    });
  } catch (error) {
    console.error("Error initializing Cytoscape:", error);
    document.body.innerHTML =
      '<p style="color: red; padding: 10px;">Error initializing graph visualization.</p>';
  }
} // end of initializeCytoscape function

// Listen for graph data from extension
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "INIT_GRAPH") {
    try {
      // Pass both the graph data AND the new targetId
      initializeCytoscape(message.data, message.targetId);
    } catch (error) {
      console.error("Error initializing graph:", error);
      document.body.innerHTML =
        '<p style="color: red; padding: 10px;">Error loading graph data.</p>';
    }
  } else if (message.type === "ADD_ELEMENTS") {
    // This is the new logic to handle expanding a node
    if (cy && message.data) {
      console.log("Adding new elements:", message.data);

      // Add the new nodes and edges to the graph
      cy.add(message.data.nodes);
      cy.add(message.data.edges);

      // Re-run the layout so the graph adjusts nicely
      cy.layout({
        name: "cose",
        fit: true,
        padding: 30,
        animate: true, // Animate the transition
        animationDuration: 500, // 0.5 second animation
        idealEdgeLength: 100,
        nodeOverlap: 20,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
      }).run();
    }
  }
});
