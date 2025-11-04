// Graph visualization logic will be merged from PR

import { CallHierarchy, FunctionCall, CytoscapeGraph, CytoscapeNode, CytoscapeEdge } from "./types";

/**
 * Transforms the backend CallHierarchy data into a Cytoscape.js compatible graph format.
 * * @param hierarchy The raw call hierarchy data from the analyzer.
 * @returns A CytoscapeGraph object (nodes and edges) ready for visualization.
 */
export function transformToCytoscapeGraph(hierarchy: CallHierarchy): CytoscapeGraph {
  const nodes: CytoscapeNode[] = [];
  const edges: CytoscapeEdge[] = [];

  // Use a Set to prevent duplicate nodes.
  // A function can be called multiple times, but should only appear as one node.
  const addedNodeIds = new Set<string>();

  /**
   * Helper function to generate a unique ID for a function call.
   * This ID is used by Cytoscape to connect edges.
   * Format: "functionName @ filePath:lineNumber"
   */
  const getUniqueId = (func: FunctionCall): string => {
    return `${func.name} @ ${func.filePath}:${func.line}`;
  };

  /**
   * Helper function to add a node to the graph if it hasn't been added yet.
   */
  const addNode = (func: FunctionCall) => {
    const id = getUniqueId(func);
    if (!addedNodeIds.has(id)) {
      addedNodeIds.add(id);
      nodes.push({
        data: {
          id: id,
          label: func.name, // The label shown on the graph
        },
      });
    }
  };

  // 1. Add the target node (the function the user clicked on)
  const targetId = getUniqueId(hierarchy.target);
  addNode(hierarchy.target);

  // 2. Process incoming calls (callers)
  // Edge direction: [Caller] ---> [Target]
  for (const incomingFunc of hierarchy.incoming) {
    const incomingId = getUniqueId(incomingFunc);

    // Add the caller node
    addNode(incomingFunc);

    // Add the edge from the caller to the target
    edges.push({
      data: {
        source: incomingId,
        target: targetId,
      },
    });
  }

  // 3. Process outgoing calls (callees)
  // Edge direction: [Target] ---> [Callee]
  for (const outgoingFunc of hierarchy.outgoing) {
    const outgoingId = getUniqueId(outgoingFunc);

    // Add the callee node
    addNode(outgoingFunc);

    // Add the edge from the target to the callee
    edges.push({
      data: {
        source: targetId,
        target: outgoingId,
      },
    });
  }

  return { nodes, edges };
}
