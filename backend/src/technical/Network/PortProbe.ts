import { spawnSync } from 'node:child_process'

const PROBE = [
  'const server = require("node:net").createServer()',
  'server.once("error", () => process.exit(1))',
  'server.listen(Number(process.argv[1]), "127.0.0.1", () => server.close(() => process.exit(0)))',
].join('\n')

export function probePortSync(port: number): boolean {
  const probed = spawnSync(process.execPath, ['-e', PROBE, String(port)], { timeout: 2000 })
  return probed.status === 0
}
