import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { resolvePort } from '../../ports.js'
import { createTask, getTask, getUsedPorts, updateCheckpoint } from '../../db/tasks.js'

const CHECKPOINT_VALUES = [
  'spec_done',
  'plan_done',
  'tests_written',
  'build_done',
  'reviewed',
  'simplified',
  'mr_draft_pushed',
] as const

function portKey(project: string, branch: string): string {
  return `${project}::${branch}`
}

export function registerTaskLifecycle(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      title: 'Creer une worktree',
      description:
        'Enregistre une worktree pour un projet et une branche, avec un port deterministe unique a l echelle de tous les projets suivis. repoPath (chemin disque du repo) et runCommand (commande du serveur) permettent ensuite de lancer/detruire la worktree et son serveur. feature relie plusieurs worktrees (front + back).',
      inputSchema: {
        project: z.string().min(1).describe('Identite stable du repo : remote git ou chemin racine'),
        branch: z.string().min(1),
        repoPath: z.string().min(1).optional().describe('Chemin disque du repo'),
        runCommand: z.string().min(1).optional().describe('Commande de lancement (le port est injecte via PORT)'),
        feature: z.string().min(1).optional().describe('Groupe reliant plusieurs worktrees (front + back)'),
      },
    },
    (args) => {
      const existing = getTask(args.project, args.branch)
      const port =
        existing !== null
          ? existing.port
          : resolvePort(portKey(args.project, args.branch), new Set(getUsedPorts()))
      const task = createTask({
        project: args.project,
        branch: args.branch,
        port,
        repoPath: args.repoPath,
        runCommand: args.runCommand,
        feature: args.feature,
      })
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      }
    },
  )

  server.registerTool(
    'update_checkpoint',
    {
      title: 'Mettre a jour un checkpoint',
      description: 'Ecrit le checkpoint franchi et des notes de contexte lisibles sur la worktree',
      inputSchema: {
        project: z.string().min(1),
        branch: z.string().min(1),
        checkpoint: z.enum(CHECKPOINT_VALUES),
        contextSummary: z.string().min(1),
      },
    },
    (args) => {
      const task = updateCheckpoint(args.project, args.branch, args.checkpoint, args.contextSummary)
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
