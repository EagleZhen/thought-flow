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
    // [FIX] This is the new logic to handle expanding a node
    if (cy && message.data) {
      console.log("Received new elements:", message.data);

      let nodesToAdd = [];
      if (Array.isArray(message.data.nodes)) {
        for (const node of message.data.nodes) {
          // Check if node already exists
          if (cy.getElementById(node.data.id).empty()) {
            nodesToAdd.push(node);
          }
        }
      }

      let edgesToAdd = [];
      if (Array.isArray(message.data.edges)) {
        for (const edge of message.data.edges) {
          // Check if edge already exists
          if (cy.getElementById(edge.data.id).empty()) {
            edgesToAdd.push(edge);
          }
        }
      }

      // Only add if there are new nodes or edges
      if (nodesToAdd.length > 0) {
        console.log(
          "Adding new nodes:",
          nodesToAdd.map((n) => n.data.id)
        );
        cy.add(nodesToAdd);
      }
      if (edgesToAdd.length > 0) {
        console.log(
          "Adding new edges:",
          edgesToAdd.map((e) => e.data.id)
        );
        cy.add(edgesToAdd);
      }

      // Only re-run layout if something was actually added
      if (nodesToAdd.length > 0 || edgesToAdd.length > 0) {
        console.log("Running layout for new elements...");
        cy.layout({
          name: "cose",
          fit: false,
          padding: 30,
          animate: true, // Animate the transition
          animationDuration: 500, // 0.5 second animation
          idealEdgeLength: 100,
          nodeOverlap: 20,
          componentSpacing: 100,
          nodeRepulsion: 400000,
          edgeElasticity: 100,
        }).run();
      } else {
        console.log("No new elements to add. Skipping layout.");
      }
    }
  }
});
