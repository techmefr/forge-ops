import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { type Request, type Response } from 'express'
import { listTaskItems, listTasks } from '../db/tasks.js'
import { listArchNodes } from '../db/arch.js'
import { isPortListening } from '../health.js'
import {
  addItem,
  cleanupWorktree,
  createWorktree,
  escalate,
  finishTask,
  launchWorktree,
  startWorktreeServer,
  stopWorktreeServer,
  toggleItem,
} from '../operations.js'

const MODULE_DIR = dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = join(MODULE_DIR, 'public')
const DEFAULT_DASHBOARD_PORT = 4999
const DEFAULT_DASHBOARD_HOST = 'starfleet.local'
const URL_HOST = process.env.STARFLEET_URL_HOST ?? 'localhost'

function send(res: Response, result: { ok: boolean; error?: string; detail?: string; data?: unknown }): void {
  res.status(result.ok ? 200 : result.error === 'not_found' ? 404 : 400).json(result)
}

export function createDashboardApp(): express.Express {
  const app = express()
  app.use(express.json())
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

  app.get('/api/arch', (_req: Request, res: Response) => {
    res.json(listArchNodes())
  })

  app.post('/api/tasks', (req: Request, res: Response) => {
    const { project, branch, repoPath, runCommand, feature, role } = req.body ?? {}
    if (!project || !branch) {
      return res.status(400).json({ ok: false, error: 'project et branch requis' })
    }
    send(res, createWorktree({ project, branch, repoPath, runCommand, feature, role }))
  })

  app.post('/api/worktree/launch', (req: Request, res: Response) => {
    send(res, launchWorktree(req.body?.project, req.body?.branch))
  })

  app.post('/api/server/start', (req: Request, res: Response) => {
    send(res, startWorktreeServer(req.body?.project, req.body?.branch))
  })

  app.post('/api/server/stop', (req: Request, res: Response) => {
    send(res, stopWorktreeServer(req.body?.project, req.body?.branch))
  })

  app.post('/api/escalate', (req: Request, res: Response) => {
    const { project, branch, reason } = req.body ?? {}
    if (!reason) {
      return res.status(400).json({ ok: false, error: 'reason requise' })
    }
    send(res, escalate(project, branch, reason))
  })

  app.post('/api/cleanup', (req: Request, res: Response) => {
    send(res, cleanupWorktree(req.body?.project, req.body?.branch))
  })

  app.post('/api/finish', (req: Request, res: Response) => {
    send(res, finishTask(req.body?.project, req.body?.branch, req.body?.base ?? 'develop'))
  })

  app.post('/api/task-items', (req: Request, res: Response) => {
    const { project, branch, label } = req.body ?? {}
    if (!label) {
      return res.status(400).json({ ok: false, error: 'label requis' })
    }
    send(res, addItem(project, branch, label))
  })

  app.patch('/api/task-items/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id)
    send(res, toggleItem(id, Boolean(req.body?.done)))
  })

  return app
}

function main(): void {
  const portEnv = process.env.STARFLEET_DASHBOARD_PORT ?? process.env.PORT
  const port = portEnv ? Number(portEnv) : DEFAULT_DASHBOARD_PORT
  const host = process.env.STARFLEET_DASHBOARD_HOST ?? DEFAULT_DASHBOARD_HOST
  const app = createDashboardApp()
  app.listen(port, () => {
    console.log(`Dashboard starfleet disponible sur http://${host}:${port}`)
  })
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url)
if (isDirectRun) {
  main()
}
