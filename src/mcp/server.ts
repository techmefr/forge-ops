import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerListWorktrees } from './tools/listWorktrees.js'
import { registerGetWorktreeStatus } from './tools/getWorktreeStatus.js'
import { registerEscalate } from './tools/escalate.js'
import { registerCleanup } from './tools/cleanup.js'
import { registerTaskLifecycle } from './tools/taskLifecycle.js'
import { registerWorktreeOps } from './tools/worktreeOps.js'
import { registerTaskItems } from './tools/taskItems.js'
import { registerArch } from './tools/arch.js'
import { registerFleetView } from './tools/fleetView.js'

async function main(): Promise<void> {
  const server = new McpServer({
    name: 'starfleet',
    version: '0.1.0',
  })

  registerListWorktrees(server)
  registerGetWorktreeStatus(server)
  registerEscalate(server)
  registerCleanup(server)
  registerTaskLifecycle(server)
  registerWorktreeOps(server)
  registerTaskItems(server)
  registerArch(server)
  registerFleetView(server)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error: unknown) => {
  console.error('Le serveur MCP starfleet a echoue au demarrage:', error)
  process.exitCode = 1
})
