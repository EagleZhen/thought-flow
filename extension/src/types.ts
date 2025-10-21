/**
 * Reference to a function in the codebase.
 * filePath + name + line uniquely identify a function.
 */
export interface FunctionCall {
  /** Function name. Example: "greet", "main" */
  name: string;

  /** File path relative to workspace. Example: "main.py", "src/utils.py" */
  filePath: string;

  /** Line number (1-indexed) */
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
     * Unique identifier (format: name @ filePath:line)
     * Used internally for graph operations and edge connections
     * Example: "greet @ main.py:5", "helper @ src/utils.py:10"
     */
    id: string;

    /**
     * Display label shown on the graph node
     * Typically just the function name for readability
     * Example: "greet", "helper"
     */
    label: string;
  };
}
