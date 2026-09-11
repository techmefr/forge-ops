import { execFileSync } from 'node:child_process'

export const LOOPBACK_HOST = '127.0.0.1'

const PROBE_TIMEOUT_MS = 5_000

const PROBE_SCRIPT = [
  "const { createServer } = require('node:net')",
  'const server = createServer()',
  "server.once('error', () => process.exit(1))",
  `server.listen({ host: '${LOOPBACK_HOST}', port: Number(process.argv[1]), exclusive: true }, () =>`,
  '  server.close(() => process.exit(0)),',
  ')',
].join('\n')

export function isPortBindable(port: number): boolean {
  try {
    execFileSync(process.execPath, ['-e', PROBE_SCRIPT, String(port)], {
      stdio: 'ignore',
      timeout: PROBE_TIMEOUT_MS,
    })
    return true
  } catch {
    return false
  }
}
