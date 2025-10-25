/**
 * Initializes the Cytoscape graph with the provided data.
 * @param {object} graphData - The graph data object, expected format like { nodes: [...], edges: [...] }
 * or directly the elements array Cytoscape expects.
 */
function initializeCytoscape(graphData) {
  // Check if graphData has nodes and edges properties, otherwise assume it's the elements array directly
    const elements =
        graphData && Array.isArray(graphData.nodes) && Array.isArray(graphData.edges)
            ? [...graphData.nodes, ...graphData.edges]
            : graphData; // Fallback assuming graphData is already the elements array

    if (!elements || !Array.isArray(elements)) {
        console.error("Invalid graph data format received:", graphData);
        document.body.innerHTML =
            '<p style="color: red; padding: 10px;">Error: Invalid graph data format.</p>';
        return;
    }

    try {
        const cy = cytoscape({
            container: document.getElementById("cy"), // The div where the graph will be rendered

            elements: elements, // The nodes and edges data

            style: [
                // Define the visual style of nodes and edges
                {
                    selector: 'node', // Style for all nodes
                    style: {
                        'background-color': '#4376c2',
                        'label': 'data(label)', // Use 'label' if available, otherwise 'id'
                        'color': '#7a96c0',
                        'font-family': 'Consolas',
                    },
                },
                /*
                {
                    selector: "node:parent", // Style for parent nodes (groups)
                    style: {
                        "background-opacity": 0.3,
                        "background-color": "#4a72bbff",
                        "border-color": "#4376c2ff",
                        "border-width": 2,
                        label: 'data(label)',
                        "text-valign": "top",
                        "text-halign": "center",
                    },
                },
                */
                {
                    selector: 'edge', // Style for all edges
                    style: {
                        width: 3,
                        'line-color': '#7a96c0',
                        'target-arrow-color': '#7a96c0', // Color of the arrow head
                        'target-arrow-shape': 'triangle', // Shape of the arrow head
                        'curve-style': 'bezier', // How the edge curves ('bezier', 'straight', 'haystack', etc.)
                        'opacity': 0.5,
                    },
                },
                // Add more style rules as needed
            ],            
            ///*
            layout: {
                // Define how nodes are positioned
                name: "cose", // 'cose' layout (Compound Spring Embedder) is good for general graphs
                idealEdgeLength: 100, // Preferred distance between connected nodes
                nodeOverlap: 20, // Amount of space between nodes
                refresh: 20, // Number of iterations per animation frame
                fit: true, // Whether to fit the graph to the viewport
                padding: 30, // Padding around the graph
                randomize: false, // Whether to randomize node positions before layout
                componentSpacing: 100, // Space between disconnected components
                nodeRepulsion: 400000, // How much nodes push each other away
                edgeElasticity: 100, // How much edges pull nodes together
                nestingFactor: 5, // How tightly grouped parent nodes contain child nodes
                gravity: 80, // Attracts nodes to the center
                numIter: 1000, // Maximum number of layout iterations
                initialTemp: 200, // Initial temperature (for simulated annealing)
                coolingFactor: 0.95, // How quickly temperature cools
                minTemp: 1.0, // Minimum temperature
                // Other layout options: 'grid', 'circle', 'breadthfirst', 'concentric'
            },
            //*/
        });

        // --- Add Interactivity Below ---

        // Example: Log node ID when a node is clicked
        cy.on("tap", "node", function (evt) {
            const node = evt.target;
            console.log("Tapped node id: " + node.id() + ", label: " + node.data("label"));
            // You can add more interactive features here, e.g., highlight neighbors, show info panel
        });

        // Example: Log edge info when an edge is clicked
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

// --- Code to run when the page loads ---
(function () {
    // Find the script tag containing the JSON data
    const dataElement = document.getElementById("graph-data");
    const graphDataJson = dataElement ? dataElement.textContent : "{}";
    let graphData;

    try {
        // Parse the JSON string into a JavaScript object
        graphData = JSON.parse(graphDataJson);
        // Call the function to initialize the graph with the parsed data
        initializeCytoscape(graphData);
    } catch (error) {
        console.error("Error parsing graph data JSON:", error, "Raw JSON:", graphDataJson);
        // Display an error message in the webview
        document.body.innerHTML =
            '<p style="color: red; padding: 10px;">Error loading graph data. Invalid JSON format.</p>';
    }
})();
