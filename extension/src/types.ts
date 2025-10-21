/**
 * Reference to a function in the codebase.
 */
export interface FunctionCall {
  /**
   * Function name
   * @example "greet", "main"
   */
  name: string;

  /**
   * File path relative to workspace
   * @example "main.py", "src/utils.py"
   */
  filePath: string;

  /**
   * Line number (1-indexed)
   * @example 5, 42
   */
  line: number;
}

/**
 * Call hierarchy analysis result.
 * Represents call relationships for a target function.
 */
export interface CallHierarchy {
  /** The function being analyzed */
  target: FunctionCall;

  /** Incoming calls (functions that call the target) */
  incoming: FunctionCall[];

  /** Outgoing calls (functions called by the target) */
  outgoing: FunctionCall[];
}

/**
 * A node in the Cytoscape graph.
 */
export interface CytoscapeNode {
  data: {
    /**
     * Unique identifier (format: name @ filePath:line).
     * Used internally for graph operations and edge connections.
     * @example "greet @ main.py:5", "helper @ src/utils.py:10"
     */
    id: string;

    /**
     * Display label shown on the graph node.
     * Typically just the function name for readability.
     * @example "greet", "helper"
     */
    label: string;
  };
}

/**
 * An edge in the Cytoscape graph representing a function call.
 */
export interface CytoscapeEdge {
  data: {
    /** Source node ID (caller) */
    source: string;

    /** Target node ID (callee) */
    target: string;
  };
}

/**
 * Cytoscape graph data structure.
 */
export interface CytoscapeGraph {
  /** Graph nodes (functions) */
  nodes: CytoscapeNode[];

  /** Graph edges (function calls) */
  edges: CytoscapeEdge[];
}
