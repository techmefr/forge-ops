import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { getTask, setPid, setWorktreePath } from '../../db/tasks.js'
import { addWorktreeForBranch } from '../../git/worktree.js'
import { isProcessAlive, startServer, stopServer } from '../../process/runner.js'

function notFound(project: string, branch: string): { content: { type: 'text'; text: string }[]; isError: true } {
  return {
    content: [{ type: 'text', text: `Aucune tache trouvee pour ${project} / ${branch}` }],
    isError: true,
  }
}

export function registerWorktreeOps(server: McpServer): void {
  server.registerTool(
    'launch_worktree',
    {
      title: 'Lancer une worktree git',
      description:
        'Cree reellement la worktree git (git worktree add) pour la branche, dans un dossier voisin du repo. Necessite repoPath sur la tache.',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
      },
    },
    (args) => {
      const task = getTask(args.project, args.branch)
      if (task === null) {
        return notFound(args.project, args.branch)
      }
      if (task.repoPath === null) {
        return {
          content: [{ type: 'text', text: 'repoPath manquant sur la tache : renseigne-le via create_task' }],
          isError: true,
        }
      }
      const result = addWorktreeForBranch(task.repoPath, args.branch)
      if (result.created && result.path !== null) {
        setWorktreePath(args.project, args.branch, result.path)
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )

  server.registerTool(
    'start_server',
    {
      title: 'Demarrer le serveur d une worktree',
      description:
        'Lance runCommand en injectant le port alloue (PORT), depuis la worktree si elle existe sinon le repo. Enregistre le PID.',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
      },
    },
    (args) => {
      const task = getTask(args.project, args.branch)
      if (task === null) {
        return notFound(args.project, args.branch)
      }
      if (task.runCommand === null) {
        return {
          content: [{ type: 'text', text: 'runCommand manquant sur la tache : renseigne-le via create_task' }],
          isError: true,
        }
      }
      if (task.pid !== null && isProcessAlive(task.pid)) {
        return {
          content: [{ type: 'text', text: `Un serveur tourne deja (pid ${task.pid}) sur le port ${task.port}` }],
        }
      }
      const cwd = task.worktreePath ?? task.repoPath
      const result = startServer(task.runCommand, task.port, cwd)
      setPid(args.project, args.branch, result.pid)
      return { content: [{ type: 'text', text: JSON.stringify({ ...result, port: task.port }, null, 2) }] }
    },
  )

  server.registerTool(
    'stop_server',
    {
      title: 'Arreter le serveur d une worktree',
      description: 'Tue le process lance par starfleet pour cette worktree et efface son PID.',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
      },
    },
    (args) => {
      const task = getTask(args.project, args.branch)
      if (task === null) {
        return notFound(args.project, args.branch)
      }
      if (task.pid === null) {
        return { content: [{ type: 'text', text: 'Aucun serveur lance par starfleet pour cette worktree' }] }
      }
      const result = stopServer(task.pid)
      if (result.stopped) {
        setPid(args.project, args.branch, null)
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    },
  )
}
