const vscode = acquireVsCodeApi();
let cy;

/**
 * Visual configuration constants
 */
const COLORS = {
  TARGET: "#d9a40e", // Gold for focused node
  FUNCTION: "#4376c2", // Blue for user functions
  SYSTEM: "#9e9e9e", // Gray for built-in calls like 'print'
  EDGE: "#7a96c0",
  TEXT: "#333333",
};

function initializeCytoscape(graphData, targetNodeId) {
  // Merge nodes and edges for Cytoscape
  const elements = graphData && graphData.nodes ? [...graphData.nodes, ...graphData.edges] : [];

  const targetNodeSelector = `node[id = "${targetNodeId}"]`;

  try {
    cy = cytoscape({
      container: document.getElementById("cy"),
      elements: elements,
      style: [
        {
          selector: "node",
          style: {
            "background-color": (node) => {
              const label = node.data("label");
              // Dim specific system functions to reduce visual noise
              if (label === "print" || label === "<module>") return COLORS.SYSTEM;
              return COLORS.FUNCTION;
            },
            label: "data(label)",
            color: COLORS.TEXT,
            shape: "round-rectangle", // Softer corners
            width: "label",
            height: "label",
            padding: "10px",
            "font-family": "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
            "font-size": "12px",
            "text-valign": "center",
            "text-halign": "center",
            "border-width": 0,
            "transition-property": "background-color, transform",
            "transition-duration": "0.3s",
          },
        },
        {
          selector: targetNodeSelector,
          style: {
            "background-color": COLORS.TARGET,
            "border-width": 2,
            "border-color": "#ffffff",
            "font-weight": "bold",
            "z-index": 100,
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": COLORS.EDGE,
            "target-arrow-color": COLORS.EDGE,
            "target-arrow-shape": "vee", // Modern arrow shape
            "curve-style": "bezier",
            "control-point-step-size": 40,
            opacity: 0.4,
            "transition-property": "opacity",
            "transition-duration": "0.3s",
          },
        },
        {
          // Interaction: Highlight on hover
          selector: "node:selected",
          style: {
            "border-width": 3,
            "border-color": "#000",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: true,
        animationDuration: 800,
        refresh: 20,
        fit: true,
        padding: 50,
        // Physics adjustments for a more "artistic" cluster
        nodeRepulsion: 10000, // Balanced spacing
        idealEdgeLength: 80, // Keep connections tight
        componentSpacing: 60,
        gravity: 1.5, // Pull nodes toward the center
        numIter: 1000,
      },
    });

    // Node Click Event - Check for Ctrl/Cmd modifier
    cy.on("tap", "node", function (evt) {
      const node = evt.target;
      const nodeId = node.id();
      const originalEvent = evt.originalEvent;

      // Visual feedback: briefly highlight the tapped node
      node.flashClass("highlighted", 200);

      // Check if Ctrl (Windows/Linux) or Cmd (Mac) key is pressed
      const isCtrlClick = originalEvent.ctrlKey || originalEvent.metaKey;

      if (isCtrlClick) {
        // Ctrl+Click - Navigate to code only
        vscode.postMessage({
          type: "NODE_CTRL_CLICKED",
          payload: { id: nodeId },
        });
      } else {
        // Regular Click - Expand graph
        vscode.postMessage({
          type: "NODE_TAPPED",
          payload: { id: nodeId },
        });
      }
    });
  } catch (error) {
    console.error("Layout Initialization Error:", error);
  }
}

/**
 * Message listener for extension communication
 */
window.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "INIT_GRAPH") {
    initializeCytoscape(message.data, message.targetId);
  } else if (message.type === "ADD_ELEMENTS") {
    if (cy && message.data) {
      // Filter out existing elements to prevent duplicates
      const newNodes = (message.data.nodes || []).filter((n) =>
        cy.getElementById(n.data.id).empty()
      );
      // [FIX] Added checks for edge.data and edge.data.id to prevent null reference errors
      const newEdges = (message.data.edges || []).filter(
        (e) => e.data && e.data.id && cy.getElementById(e.data.id).empty()
      );

      if (newNodes.length > 0) cy.add(newNodes);
      if (newEdges.length > 0) cy.add(newEdges);

      // Re-run layout with a smooth transition
      if (newNodes.length > 0 || newEdges.length > 0) {
        cy.layout({
          name: "cose",
          animate: true,
          animationDuration: 600,
          nodeRepulsion: 10000,
          gravity: 1.2,
          fit: false, // Don't zoom out completely on every expansion
        }).run();
      }
    }
  }
});

/**
 * Export graph as PNG
 */
document.getElementById("export-btn").addEventListener("click", function () {
  if (!cy) {
    console.error("Cytoscape instance not initialized");
    return;
  }

  try {
    // Generate PNG data URL with high quality
    const pngData = cy.png({
      output: "blob",
      full: true,
      scale: 3, // 3x resolution for better quality
    });

    // Create download link
    const url = URL.createObjectURL(pngData);
    const link = document.createElement("a");
    link.href = url;
    // Format: call-graph-2025-12-21-183045.png (includes seconds to avoid duplication)
    const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, "").replace("T", "-");
    link.download = `call-graph-${dateStr}.png`;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error exporting PNG:", error);
  }
});
