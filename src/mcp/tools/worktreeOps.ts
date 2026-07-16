import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { launchWorktree, startWorktreeServer, stopWorktreeServer } from '../../operations.js'
import type { ITask } from '../../types/task.js'
import type { IOpResult } from '../../operations.js'

function present(result: IOpResult<ITask>): { content: { type: 'text'; text: string }[]; isError?: true } {
  if (!result.ok && result.data === undefined) {
    return { content: [{ type: 'text', text: result.detail ?? result.error ?? 'echec' }], isError: true }
  }
  return { content: [{ type: 'text', text: JSON.stringify({ detail: result.detail, task: result.data }, null, 2) }] }
}

export function registerWorktreeOps(server: McpServer): void {
  server.registerTool(
    'launch_worktree',
    {
      title: 'Lancer une worktree git',
      description: 'Cree reellement la worktree git (git worktree add) dans un dossier voisin du repo. Necessite repoPath.',
      inputSchema: { project: z.string().min(1), branch: z.string().min(1) },
    },
    (args) => present(launchWorktree(args.project, args.branch)),
  )

  server.registerTool(
    'start_server',
    {
      title: 'Demarrer le serveur d une worktree',
      description: 'Lance runCommand en injectant le port (PORT), depuis la worktree si elle existe. Enregistre le PID.',
      inputSchema: { project: z.string().min(1), branch: z.string().min(1) },
    },
    (args) => present(startWorktreeServer(args.project, args.branch)),
  )

  server.registerTool(
    'stop_server',
    {
      title: 'Arreter le serveur d une worktree',
      description: 'Tue le process lance par starfleet pour cette worktree et efface son PID.',
      inputSchema: { project: z.string().min(1), branch: z.string().min(1) },
    },
    (args) => present(stopWorktreeServer(args.project, args.branch)),
  )
}
