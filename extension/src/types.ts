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
