import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getTaskByBranch } from '../../db/tasks.js'

export function registerGetWorktreeStatus(server: McpServer): void {
  server.registerTool(
    'get_worktree_status',
    {
      title: 'Statut d une worktree',
      description: 'Recupere le statut complet d une tache a partir du nom de sa branche',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const task = getTaskByBranch(args.branch)
      if (task === null) {
        return {
          content: [{ type: 'text', text: `Aucune tache trouvee pour la branche ${args.branch}` }],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      }
    },
  )
}
