import type { Context } from 'hono'

export const LOCAL_OPERATOR = 'local'

declare module 'hono' {
  interface ContextVariableMap {
    login: string
  }
}

export function operatorOf(context: Context): string {
  const login = context.get('login')
  return typeof login === 'string' && login !== '' ? login : LOCAL_OPERATOR
}
