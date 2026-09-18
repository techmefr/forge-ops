import { Hono } from 'hono'
import type { Context } from 'hono'
import { z } from 'zod'
import { PROVIDER_KINDS, waysIn } from './Organisation.js'
import {
  InstanceTokenNotFoundError,
  ProviderRefusedError,
  type OrganisationRepository,
} from './OrganisationRepository.js'

const identifierSchema = z.coerce.number().int().positive()

const providerSchema = z.object({
  kind: z.enum(PROVIDER_KINDS),
  enabled: z.boolean(),
  issuer: z.string().trim().min(1).nullable().default(null),
  clientId: z.string().trim().min(1).nullable().default(null),
})

const tokenSchema = z.object({ name: z.string().trim().min(1).max(80) })

export type OrganisationApiInput = {
  organisations: OrganisationRepository
  maySettle: (context: Context) => boolean
}

export function createOrganisationApi({
  organisations,
  maySettle,
}: OrganisationApiInput): Hono {
  const api = new Hono()

  api.onError((error, context) => {
    if (error instanceof ProviderRefusedError) {
      return context.json({ error: 'ProviderRefused', refusal: error.refusal }, 422)
    }
    if (error instanceof InstanceTokenNotFoundError) {
      return context.json({ error: 'InstanceTokenNotFound', message: error.message }, 404)
    }
    return context.json({ error: 'UnexpectedError' }, 500)
  })

  api.get('/api/organisation', (context) => {
    const organisation = organisations.soleOrganisation()
    const providers = organisations.listProviders(organisation.id)
    return context.json({
      organisation,
      providers,
      waysIn: waysIn(providers),
      maySettle: maySettle(context),
    })
  })

  api.post('/api/organisation/providers', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'ProviderNeedsAnAdmin' }, 403)
    }
    const draft = providerSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'InvalidProvider', issues: draft.error.issues }, 422)
    }
    const organisation = organisations.soleOrganisation()
    return context.json(organisations.settleProvider(organisation.id, draft.data))
  })

  api.get('/api/instance/tokens', (context) =>
    context.json(organisations.listTokens(organisations.soleOrganisation().id)),
  )

  api.post('/api/instance/tokens', async (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'InstanceTokenNeedsAnAdmin' }, 403)
    }
    const draft = tokenSchema.safeParse(await context.req.json().catch(() => null))
    if (!draft.success) {
      return context.json({ error: 'MissingTokenName' }, 422)
    }
    const organisation = organisations.soleOrganisation()
    return context.json(organisations.mintToken(organisation.id, draft.data.name), 201)
  })

  api.delete('/api/instance/tokens/:id', (context) => {
    if (!maySettle(context)) {
      return context.json({ error: 'InstanceTokenNeedsAnAdmin' }, 403)
    }
    const tokenId = identifierSchema.safeParse(context.req.param('id'))
    if (!tokenId.success) {
      return context.json({ error: 'InvalidTokenIdentifier' }, 422)
    }
    return context.json(organisations.revokeToken(tokenId.data))
  })

  return api
}
