import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { checkpoint, createWorktree } from '../../operations.js'

const CHECKPOINT_VALUES = [
  'spec_done',
  'plan_done',
  'tests_written',
  'build_done',
  'reviewed',
  'simplified',
  'mr_draft_pushed',
] as const

export function registerTaskLifecycle(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      title: 'Creer une worktree',
      description:
        'Enregistre une worktree pour un projet et une branche, avec un port deterministe unique a l echelle de tous les projets suivis. repoPath/runCommand debloquent le lancement reel ; feature relie plusieurs worktrees (front + back).',
      inputSchema: {
        project: z.string().min(1).describe('Identite stable du repo : remote git ou chemin racine'),
        branch: z.string().min(1),
        repoPath: z.string().min(1).optional(),
        runCommand: z.string().min(1).optional(),
        feature: z.string().min(1).optional(),
      },
    },
    (args) => {
      const result = createWorktree(args)
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
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
      const result = checkpoint(args.project, args.branch, args.checkpoint, args.contextSummary)
      if (!result.ok) {
        return {
          content: [{ type: 'text', text: `Aucune tache trouvee pour ${args.project} / ${args.branch}` }],
          isError: true,
        }
      }
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
    },
  )
}
