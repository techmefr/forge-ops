import type { Context } from 'hono'
import type { z } from 'zod'

export async function parseBody<Schema extends z.ZodType>(
  context: Context,
  schema: Schema,
): Promise<z.ZodSafeParseResult<z.output<Schema>>> {
  return schema.safeParse(await context.req.json().catch(() => null))
}
