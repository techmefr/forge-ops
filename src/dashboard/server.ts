import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'
import { listTaskItems, listTasks } from '../db/tasks.js'
import { isPortListening } from '../health.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(MODULE_DIR, 'public')
const DEFAULT_DASHBOARD_PORT = 4999
const DEFAULT_DASHBOARD_HOST = 'starfleet.local'
const URL_HOST = process.env.STARFLEET_URL_HOST ?? 'localhost'

export function createDashboardApp(): express.Express {
  const app = express()
  app.use(express.static(PUBLIC_DIR))

  app.get('/api/tasks', async (_req: Request, res: Response) => {
    const tasks = listTasks()
    const enriched = await Promise.all(
      tasks.map(async (task) => ({
        ...task,
        url: `http://${URL_HOST}:${task.port}`,
        live: await isPortListening(task.port),
        items: listTaskItems(task.id),
      })),
    )
    res.json(enriched)
  })

  return app
}

function main(): void {
  const port = process.env.STARFLEET_DASHBOARD_PORT
    ? Number(process.env.STARFLEET_DASHBOARD_PORT)
    : DEFAULT_DASHBOARD_PORT
  const host = process.env.STARFLEET_DASHBOARD_HOST ?? DEFAULT_DASHBOARD_HOST
  const app = createDashboardApp()
  app.listen(port, () => {
    console.log(`Dashboard starfleet en lecture seule disponible sur http://${host}:${port}`)
  })
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
