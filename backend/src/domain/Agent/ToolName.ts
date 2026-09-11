export const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'] as const

export type WriteTool = (typeof WRITE_TOOLS)[number]

export const READ_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'LS',
  'TodoWrite',
  'WebFetch',
  'WebSearch',
  'Task',
] as const

export type ReadTool = (typeof READ_TOOLS)[number]

export const SHELL_TOOLS = ['Bash', 'PowerShell'] as const

export type ShellTool = (typeof SHELL_TOOLS)[number]

export const WRITE_TOOL_MATCHER = WRITE_TOOLS.join('|')

export function isWriteTool(tool: string): tool is WriteTool {
  return (WRITE_TOOLS as readonly string[]).includes(tool)
}
