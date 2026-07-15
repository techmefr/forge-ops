import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { addTaskItem, toggleTaskItem } from '../../db/tasks.js'

export function registerTaskItems(server: McpServer): void {
  server.registerTool(
    'add_task_item',
    {
      title: 'Ajouter une tache associee',
      description: 'Ajoute une tache (todo) rattachee a une worktree',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
        label: z.string().min(1),
      },
    },
    (args) => {
      const item = addTaskItem(args.project, args.branch, args.label)
      if (item === null) {
        return {
          content: [{ type: 'text', text: `Aucune tache trouvee pour ${args.project} / ${args.branch}` }],
          isError: true,
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(item, null, 2) }] }
    },
  )

  server.registerTool(
    'toggle_task_item',
    {
      title: 'Cocher/decocher une tache associee',
      description: 'Marque une tache associee comme faite ou a faire',
      inputSchema: {
        itemId: z.number().int().positive(),
        done: z.boolean(),
      },
    },
    (args) => {
      const item = toggleTaskItem(args.itemId, args.done)
      if (item === null) {
        return {
          content: [{ type: 'text', text: `Aucune tache associee d id ${args.itemId}` }],
          isError: true,
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(item, null, 2) }] }
    },
  )
}
