import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { allocatePort } from '../../ports.js'
import {
  createTask,
  incrementAction,
  incrementAttempt,
  recordError,
  setModelInfo,
  touchHeartbeat,
  updateCheckpoint,
} from '../../db/tasks.js'
import { recommendModel } from '../../router/modelRouter.js'

const CHECKPOINT_VALUES = [
  'spec_done',
  'plan_done',
  'tests_written',
  'build_done',
  'reviewed',
  'simplified',
  'mr_draft_pushed',
] as const

const STEP_VALUES = [
  'SPEC',
  'PLAN',
  'TEST',
  'BUILD',
  'REVIEW',
  'CODE-SIMPLIFY',
  'SHIP',
  'mechanical',
  'creative',
] as const

export function registerTaskLifecycle(server: McpServer): void {
  server.registerTool(
    'create_task',
    {
      title: 'Creer une worktree',
      description: 'Enregistre une nouvelle tache avec allocation deterministe du port a partir du nom de branche',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const port = allocatePort(args.branch)
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
      description: 'Ecrit le checkpoint franchi et un resume condense de contexte pour la reprise apres crash',
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

  server.registerTool(
    'touch_heartbeat',
    {
      title: 'Rafraichir le heartbeat',
      description: 'Met a jour le heartbeat d une tache pour signaler qu elle est toujours active',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      touchHeartbeat(args.branch)
      return {
        content: [{ type: 'text', text: `Heartbeat mis a jour pour ${args.branch}` }],
      }
    },
  )

  server.registerTool(
    'record_attempt',
    {
      title: 'Enregistrer une tentative',
      description: 'Incremente attempt_count, escalade automatiquement au dela du cap de 5',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const result = incrementAttempt(args.branch)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    'record_action',
    {
      title: 'Enregistrer une action agent',
      description: 'Incremente action_count, escalade automatiquement au dela du plafond de 50',
      inputSchema: {
        branch: z.string().min(1),
      },
    },
    (args) => {
      const result = incrementAction(args.branch)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    'record_error',
    {
      title: 'Enregistrer une erreur',
      description: 'Enregistre le hash de la derniere erreur, escalade si boucle detectee sur 2 tentatives consecutives',
      inputSchema: {
        branch: z.string().min(1),
        errorHash: z.string().min(1),
      },
    },
    (args) => {
      const result = recordError(args.branch, args.errorHash)
      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.registerTool(
    'recommend_model',
    {
      title: 'Recommander un modele',
      description: 'Recommande un modele pour une etape donnee et l enregistre sur la tache si une branche est fournie',
      inputSchema: {
        step: z.enum(STEP_VALUES),
        branch: z.string().min(1).optional(),
      },
    },
    (args) => {
      const recommendation = recommendModel(args.step)
      if (args.branch !== undefined) {
        setModelInfo(args.branch, recommendation.recommendedModel, null)
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(recommendation, null, 2) }],
      }
    },
  )
}
