// Verb shown for a tool chip, keyed by the CLI's tool name. Reads collapse to a plain verb;
// unknown tools fall back to the raw name.
const TOOL_VERBS: Record<string, string> = {
  Read: 'Read',
  Edit: 'Edited',
  Write: 'Created',
  Bash: 'Ran',
  Run: 'Ran',
  Grep: 'Searched',
  Glob: 'Searched',
  WebSearch: 'Searched',
  WebFetch: 'Fetched',
  Task: 'Task',
};

// What a tool chip shows. Scene/Explorer MCP tools arrive as `mcp__<server>__<tool>` (from
// either CLI); render the readable tool name ("create entity") instead of the raw id. Other
// tools use the verb map, falling back to the raw name.
export function toolChipLabel(tool: string): string {
  const mcp = /^mcp__.+?__(.+)$/.exec(tool);
  if (mcp !== null) return mcp[1].replace(/_/g, ' ');
  return TOOL_VERBS[tool] ?? tool;
}
