import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'
import { listTasks } from '../db/tasks.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(MODULE_DIR, 'public')
const DEFAULT_DASHBOARD_PORT = 4999

export function createDashboardApp(): express.Express {
  const app = express()
  app.use(express.static(PUBLIC_DIR))

  app.get('/api/tasks', (_req: Request, res: Response) => {
    const tasks = listTasks()
    res.json(tasks)
  })

  return app
}

function main(): void {
  const port = process.env.STARFLEET_DASHBOARD_PORT
    ? Number(process.env.STARFLEET_DASHBOARD_PORT)
    : DEFAULT_DASHBOARD_PORT
  const app = createDashboardApp()
  app.listen(port, () => {
    console.log(`Dashboard starfleet en lecture seule disponible sur http://localhost:${port}`)
  })
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
