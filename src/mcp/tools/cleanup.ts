import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { cleanupTask } from '../../db/tasks.js'
import { removeWorktreeForBranch } from '../../git/worktree.js'

export function registerCleanup(server: McpServer): void {
  server.registerTool(
    'cleanup',
    {
      title: 'Nettoyer une worktree',
      description:
        'Supprime la worktree git rattachee a la branche puis son entree dans la table tasks',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const worktree = removeWorktreeForBranch(args.branch)
      const rowDeleted = cleanupTask(args.branch)
      const summary = {
        branch: args.branch,
        worktreeRemoved: worktree.removed,
        worktreePath: worktree.path,
        worktreeDetail: worktree.detail,
        rowDeleted,
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
      }
    },
  )
}
