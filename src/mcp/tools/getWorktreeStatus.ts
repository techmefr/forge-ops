import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getTask } from '../../db/tasks.js'

export function registerGetWorktreeStatus(server: McpServer): void {
  server.registerTool(
    'get_worktree_status',
    {
      title: 'Statut d une worktree',
      description: 'Recupere le statut complet d une tache a partir du nom de sa branche',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
      },
    },
    (args) => {
      const task = getTask(args.project, args.branch)
      if (task === null) {
        return {
          content: [
            { type: 'text', text: `Aucune tache trouvee pour ${args.project} / ${args.branch}` },
          ],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      }
    },
  )
}
