import { Hono } from 'hono'
import {
  FORGE_VIEW_CHOICES,
  preferencesChangeSchema,
  type BoardPreferences,
  type ForgeViewChoice,
} from '../../../../contract/PreferenceContract.js'
import { operatorOf } from '../../technical/Auth/BoardIdentity.js'
import type { PreferenceRepository } from './PreferenceRepository.js'

const FORGE_VIEW_KEY = 'forgeView'

export type PreferenceApiInput = {
  preferences: PreferenceRepository
  userIdOf: (login: string) => number | null
}

function viewOf(stored: string | null): ForgeViewChoice | null {
  return FORGE_VIEW_CHOICES.find((choice) => choice === stored) ?? null
}

export function createPreferenceApi({ preferences, userIdOf }: PreferenceApiInput): Hono {
  const api = new Hono()

  api.get('/api/board/preferences', (context) => {
    const userId = userIdOf(operatorOf(context))
    const body: BoardPreferences = {
      forgeView: userId === null ? null : viewOf(preferences.read(userId, FORGE_VIEW_KEY)),
    }
    return context.json(body)
  })

  api.put('/api/board/preferences', async (context) => {
    const change = preferencesChangeSchema.safeParse(await context.req.json().catch(() => null))
    if (!change.success) {
      return context.json({ error: 'InvalidPreferences', issues: change.error.issues }, 422)
    }
    const userId = userIdOf(operatorOf(context))
    if (userId === null) {
      return context.json({ error: 'PreferenceNeedsAnAccount' }, 409)
    }
    preferences.write(userId, FORGE_VIEW_KEY, change.data.forgeView)
    const body: BoardPreferences = { forgeView: change.data.forgeView }
    return context.json(body)
  })

  return api
}
