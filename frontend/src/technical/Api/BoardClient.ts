export class BoardRequestError extends Error {
  readonly status: number
  readonly code: string
  readonly detail: Readonly<Record<string, unknown>>

  constructor(status: number, code: string, message: string, detail: Readonly<Record<string, unknown>> = {}) {
    super(message)
    this.detail = detail
    this.name = 'BoardRequestError'
    this.status = status
    this.code = code
  }
}

export type BoardClient = {
  read: <T>(path: string) => Promise<T>
  send: <T>(path: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) => Promise<T>
}

export type BoardClientInput = {
  baseUrl?: string
  fetcher?: typeof fetch
  onUnauthorized?: () => void
  headers?: () => Record<string, string>
}

export function isRejection(error: unknown): boolean {
  return error instanceof BoardRequestError && error.status === 401
}

function messageOf(
  payload: unknown,
  status: number,
): { code: string; message: string; detail: Record<string, unknown> } {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    return {
      code: typeof record.error === 'string' ? record.error : `Http${status}`,
      message: typeof record.message === 'string' ? record.message : `La requete a echoue en ${status}`,
      detail: record,
    }
  }
  return { code: `Http${status}`, message: `La requete a echoue en ${status}`, detail: {} }
}

export function createBoardClient({
  baseUrl = '',
  fetcher = fetch,
  onUnauthorized,
  headers = () => ({}),
}: BoardClientInput = {}): BoardClient {
  async function call<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetcher(`${baseUrl}${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
    })
    const raw = await response.text()
    const payload: unknown = raw === '' ? null : (JSON.parse(raw) as unknown)
    if (!response.ok) {
      if (response.status === 401) {
        onUnauthorized?.()
      }
      const { code, message, detail } = messageOf(payload, response.status)
      throw new BoardRequestError(response.status, code, message, detail)
    }
    return payload as T
  }

  return {
    read: (path) => call(path, { method: 'GET' }),

    send: (path, method, body) =>
      call(path, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
  }
}
