import express, { type Request, type Response } from 'express'
import { NotesStore } from './notes.js'

const DEFAULT_PORT = 5100
const DEFAULT_HOST = 'starfleet.local'

export function createDemoApp(store: NotesStore = new NotesStore()): express.Express {
  const app = express()
  app.use(express.json())

  app.get('/notes', (_req: Request, res: Response) => {
    res.json(store.list())
  })

  app.post('/notes', (req: Request, res: Response) => {
    const { title, body } = req.body as { title?: string; body?: string }
    if (title === undefined || body === undefined) {
      res.status(400).json({ error: 'title et body sont requis' })
      return
    }
    try {
      const note = store.create(title, body)
      res.status(201).json(note)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      res.status(400).json({ error: message })
    }
  })

  app.get('/notes/:id', (req: Request<{ id: string }>, res: Response) => {
    const note = store.get(req.params.id)
    if (note === null) {
      res.status(404).json({ error: 'note introuvable' })
      return
    }
    res.json(note)
  })

  app.delete('/notes/:id', (req: Request<{ id: string }>, res: Response) => {
    const wasRemoved = store.remove(req.params.id)
    res.status(wasRemoved ? 204 : 404).end()
  })

  return app
}

function main(): void {
  const port = process.env.DEMO_APP_PORT ? Number(process.env.DEMO_APP_PORT) : DEFAULT_PORT
  const host = process.env.DEMO_APP_HOST ?? DEFAULT_HOST
  createDemoApp().listen(port, () => {
    console.log(`demo-app disponible sur http://${host}:${port}`)
  })
}

const isDirectRun = process.argv[1]?.endsWith('server.ts') ?? false
if (isDirectRun) {
  main()
}
