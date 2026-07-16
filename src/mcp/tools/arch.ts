import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { setArch } from '../../operations.js'

export function registerArch(server: McpServer): void {
  server.registerTool(
    'set_arch_node',
    {
      title: 'Definir un noeud d architecture',
      description:
        'Enregistre ou met a jour un fichier/module de l architecture cible du projet : chemin, role (purpose), statut (planned/in_progress/done) et feature qui le livre. A appeler a l etape archi une fois l archi validee.',
      inputSchema: {
        project: z.string().min(1),
        path: z.string().min(1),
        purpose: z.string().min(1).optional(),
        status: z.enum(['planned', 'in_progress', 'done']).optional(),
        feature: z.string().min(1).optional(),
      },
    },
    (args) => {
      const result = setArch(args)
      return { content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }] }
    },
  )
}
