import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerListWorktrees } from './tools/listWorktrees.js'
import { registerGetWorktreeStatus } from './tools/getWorktreeStatus.js'
import { registerEscalate } from './tools/escalate.js'
import { registerCleanup } from './tools/cleanup.js'
import { registerCheckStaleTasks } from './tools/checkStaleTasks.js'
import { registerTaskLifecycle } from './tools/taskLifecycle.js'
import { registerCheckDocFreshness } from './tools/checkDocFreshness.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PACKAGE_JSON_PATH = join(MODULE_DIR, '..', '..', 'package.json')

function loadPackageJson(): Record<string, unknown> {
  const raw = readFileSync(PACKAGE_JSON_PATH, 'utf-8')
  return JSON.parse(raw) as Record<string, unknown>
}

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'starfleet',
    version: '0.1.0',
  })

  registerListWorktrees(server)
  registerGetWorktreeStatus(server)
  registerEscalate(server)
  registerCleanup(server)
  registerCheckStaleTasks(server)
  registerTaskLifecycle(server)
  registerCheckDocFreshness(server, loadPackageJson())

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  console.error('Le serveur MCP starfleet a echoue au demarrage:', error)
  process.exitCode = 1
})
