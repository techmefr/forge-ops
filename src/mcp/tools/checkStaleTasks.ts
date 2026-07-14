import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { DEFAULT_STALE_MINUTES, findStaleTasks } from '../../db/tasks.js'

export function registerCheckStaleTasks(server: McpServer): void {
  server.registerTool(
    'check_stale_tasks',
    {
      title: 'Detecter les taches figees',
      description:
        'Liste les taches dont le heartbeat n a pas ete mis a jour depuis X minutes et qui ne sont ni done ni escalated',
      inputSchema: {
        staleMinutes: z.number().int().positive().optional(),
      },
    },
    (args) => {
      const staleTasks = findStaleTasks(args.staleMinutes ?? DEFAULT_STALE_MINUTES)
      return {
        content: [{ type: 'text', text: JSON.stringify(staleTasks, null, 2) }],
      }
    },
  )
}
