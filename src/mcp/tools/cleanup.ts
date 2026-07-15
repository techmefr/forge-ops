import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { cleanupTask, getTask } from '../../db/tasks.js'
import { removeWorktreeForBranch } from '../../git/worktree.js'
import { isProcessAlive, stopServer } from '../../process/runner.js'

export function registerCleanup(server: McpServer): void {
  server.registerTool(
    'cleanup',
    {
      title: 'Nettoyer une worktree',
      description:
        'Supprime la worktree git rattachee a la branche puis son entree dans la table tasks',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
      },
    },
    (args) => {
      const task = getTask(args.project, args.branch)
      let serverStopped = false
      if (task !== null && task.pid !== null && isProcessAlive(task.pid)) {
        serverStopped = stopServer(task.pid).stopped
      }
      const worktree = removeWorktreeForBranch(args.branch, task?.repoPath ?? null)
      const rowDeleted = cleanupTask(args.project, args.branch)
      const summary = {
        project: args.project,
        branch: args.branch,
        serverStopped,
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
