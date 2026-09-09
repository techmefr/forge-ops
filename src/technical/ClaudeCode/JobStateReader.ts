import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const jobStateSchema = z.object({
  state: z.string(),
  cwd: z.string().nullish(),
  sessionId: z.string().nullish(),
  name: z.string().nullish(),
  intent: z.string().nullish(),
  tokens: z.number().nullish(),
  cliVersion: z.string().nullish(),
  updatedAt: z.string().nullish(),
})

const rosterSchema = z.object({
  supervisorPid: z.number().nullish(),
  updatedAt: z.number().nullish(),
  workers: z.record(z.string(), z.unknown()).nullish(),
})

export type JobState = {
  id: string
  state: string
  cwd: string | null
  sessionId: string | null
  name: string | null
  intent: string | null
  tokens: number | null
  cliVersion: string | null
  updatedAt: string | null
}

export type Roster = {
  supervisorPid: number | null
  updatedAt: number | null
  workerCount: number
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function listJobIdentifiers(jobsDir: string): readonly string[] {
  try {
    return readdirSync(jobsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch {
    return []
  }
}

export function readJobStates(claudeHome: string): readonly JobState[] {
  const jobsDir = join(claudeHome, 'jobs')

  return listJobIdentifiers(jobsDir).flatMap((id) => {
    const parsed = jobStateSchema.safeParse(readJsonFile(join(jobsDir, id, 'state.json')))
    if (!parsed.success) {
      return []
    }
    const state = parsed.data
    return [
      {
        id,
        state: state.state,
        cwd: state.cwd ?? null,
        sessionId: state.sessionId ?? null,
        name: state.name ?? null,
        intent: state.intent ?? null,
        tokens: state.tokens ?? null,
        cliVersion: state.cliVersion ?? null,
        updatedAt: state.updatedAt ?? null,
      },
    ]
  })
}

export function readRoster(claudeHome: string): Roster | null {
  const parsed = rosterSchema.safeParse(readJsonFile(join(claudeHome, 'daemon', 'roster.json')))
  if (!parsed.success) {
    return null
  }

  return {
    supervisorPid: parsed.data.supervisorPid ?? null,
    updatedAt: parsed.data.updatedAt ?? null,
    workerCount: Object.keys(parsed.data.workers ?? {}).length,
  }
}
