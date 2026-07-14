import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { cleanupTask } from '../../db/tasks.js'

export function registerCleanup(server: McpServer): void {
  server.registerTool(
    'cleanup',
    {
      title: 'Nettoyer une worktree',
      description: 'Supprime l entree de la table tasks associee a une branche',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const wasDeleted = cleanupTask(args.branch)
      return {
        content: [
          {
            type: 'text',
            text: wasDeleted
              ? `Tache supprimee pour la branche ${args.branch}`
              : `Aucune tache a supprimer pour la branche ${args.branch}`,
          },
        ],
      }
    },
  )
}
