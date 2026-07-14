import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { listTasks } from '../../db/tasks.js'
import type { TaskStatus } from '../../types/task.js'

const STATUS_VALUES: [TaskStatus, ...TaskStatus[]] = [
  'created',
  'testing',
  'failed',
  'done',
  'escalated',
  'awaiting_human',
]

export function registerListWorktrees(server: McpServer): void {
  server.registerTool(
    'list_worktrees',
    {
      title: 'Lister les worktrees',
      description: 'Liste les taches suivies dans la table tasks, avec filtre de statut optionnel',
      inputSchema: {
        status: z.enum(STATUS_VALUES).optional(),
      },
    },
    (args) => {
      const tasks = listTasks(args.status)
      return {
        content: [{ type: 'text', text: JSON.stringify(tasks, null, 2) }],
      }
    },
  )
}
