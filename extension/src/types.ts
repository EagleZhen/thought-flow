/**
 * Reference to a function in the codebase.
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
