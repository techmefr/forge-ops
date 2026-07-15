import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { escalateTask } from '../../db/tasks.js'

export function registerEscalate(server: McpServer): void {
  server.registerTool(
    'escalate',
    {
      title: 'Escalader vers un humain',
      description: 'Passe une tache en statut escalated avec une raison explicite',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
        reason: z.string().min(1),
      },
    },
    (args) => {
      const task = escalateTask(args.project, args.branch, args.reason)
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
