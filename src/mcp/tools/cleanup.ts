import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { cleanupWorktree } from '../../operations.js'

export function registerCleanup(server: McpServer): void {
  server.registerTool(
    'cleanup',
    {
      title: 'Nettoyer une worktree',
      description: 'Arrete le serveur, supprime la worktree git (git worktree remove) puis la ligne en base',
      inputSchema: { project: z.string().min(1), branch: z.string().min(1) },
    },
    (args) => {
      const result = cleanupWorktree(args.project, args.branch)
      return {
        content: [
          { type: 'text', text: JSON.stringify({ ...result.data, detail: result.detail }, null, 2) },
        ],
      }
    },
  )
}
