import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  activity,
  conflictScan,
  fileMap,
  listConflicts,
  recordActivity,
  worktreeViews,
} from '../../operations.js'

function json(payload: unknown): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

export function registerFleetView(server: McpServer): void {
  server.registerTool(
    'list_worktree_views',
    {
      title: 'Vue des worktrees',
      description:
        'Etat derive de chaque worktree : base, propre ou sale, fichiers touches / en cours / prevus, derniere activite',
      inputSchema: {
        project: z.string().min(1).optional(),
      },
    },
    (args) => json(worktreeViews(args.project).data),
  )

  server.registerTool(
    'list_files_in_flight',
    {
      title: 'Fichiers en vol',
      description:
        'Table par fichier : quelles branches l ecrivent, depuis quelle worktree, et a quel niveau de certitude (touche, en cours, prevu). A consulter avant d ecrire un fichier partage.',
      inputSchema: {
        project: z.string().min(1).optional(),
        sharedOnly: z.boolean().optional(),
      },
    },
    (args) => {
      const rows = fileMap(args.project).data ?? []
      return json(args.sharedOnly === true ? rows.filter((row) => row.shared) : rows)
    },
  )

  server.registerTool(
    'check_conflicts',
    {
      title: 'Verifier les conflits',
      description:
        'Fusionne en memoire chaque paire de branches suivies (git merge-tree, etat sale inclus) et rapporte les conflits reels. Ne verrouille rien : alerte seulement.',
      inputSchema: {
        project: z.string().min(1).optional(),
        rescan: z.boolean().optional(),
      },
    },
    (args) => {
      if (args.rescan === false) {
        return json(listConflicts(args.project).data)
      }
      return json(conflictScan(args.project).data)
    },
  )

  server.registerTool(
    'record_activity',
    {
      title: 'Journaliser une activite',
      description:
        'Enregistre un evenement de travail (outil, fichier, session). Sert de flux d activite et de battement de coeur : sans evenement recent, la worktree est affichee inactive.',
      inputSchema: {
        tool: z.string().min(1),
        project: z.string().min(1).optional(),
        branch: z.string().min(1).optional(),
        worktreePath: z.string().min(1).optional(),
        session: z.string().min(1).optional(),
        filePath: z.string().min(1).optional(),
      },
    },
    (args) => json(recordActivity(args).data),
  )

  server.registerTool(
    'list_activity',
    {
      title: 'Flux d activite',
      description: 'Derniers evenements enregistres, tous projets confondus',
      inputSchema: {
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    (args) => json(activity(args.limit).data),
  )
}
