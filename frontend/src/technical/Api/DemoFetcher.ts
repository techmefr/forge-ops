export type DemoSnapshot = Record<string, unknown>

export const DEMO_REFUSAL = {
  error: 'DemonstrationFigee',
  message:
    'Cette page est une visite de forge-ops sur des donnees figees : rien ne peut y etre ecrit. Installez le board pour le lancer pour de vrai.',
}

function respond(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function createDemoFetcher(load: () => Promise<DemoSnapshot>): typeof fetch {
  let loading: Promise<DemoSnapshot> | null = null

  return async (input, init) => {
    const path = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url
    const method = init?.method ?? 'GET'
    if (method !== 'GET') {
      return respond(DEMO_REFUSAL, 409)
    }
    loading = loading ?? load()
    const snapshot = await loading
    const held = snapshot[path]
    if (held === undefined) {
      return respond({ error: 'HorsVisite', message: `${path} ne fait pas partie de la visite figee` }, 404)
    }
    return respond(held, 200)
  }
}
