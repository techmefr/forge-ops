import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { resolvePort } from '../../ports.js'
import { createTask, getTaskByBranch, getUsedPorts, updateCheckpoint } from '../../db/tasks.js'

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
        'Enregistre une nouvelle tache avec allocation deterministe du port a partir du nom de branche (resolution de collision par sondage lineaire)',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const existing = getTaskByBranch(args.branch)
      const port = existing !== null ? existing.port : resolvePort(args.branch, new Set(getUsedPorts()))
      const task = createTask(args.branch, port)
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
        branch: z.string().min(1),
        checkpoint: z.enum(CHECKPOINT_VALUES),
        contextSummary: z.string().min(1),
      },
    },
    (args) => {
      const task = updateCheckpoint(args.branch, args.checkpoint, args.contextSummary)
      if (task === null) {
        return {
          content: [{ type: 'text', text: `Aucune tache trouvee pour la branche ${args.branch}` }],
          isError: true,
        }
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(task, null, 2) }],
      }
    },
  )
}
