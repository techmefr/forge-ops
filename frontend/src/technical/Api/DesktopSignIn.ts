export type DeepLinkAnswer = { code: string } | { error: string } | null

const SCHEME = 'forgeops:'
const AUTH_HOST = 'auth'

export function answerOfDeepLink(link: string): DeepLinkAnswer {
  let url: URL
  try {
    url = new URL(link)
  } catch {
    return null
  }
  if (url.protocol !== SCHEME || url.hostname !== AUTH_HOST) {
    return null
  }
  const code = url.searchParams.get('code')
  if (code !== null && code !== '') {
    return { code }
  }
  return { error: url.searchParams.get('error') ?? 'refused' }
}

export function startUrlOf(instanceUrl: string, provider: string, isDesktop: boolean, challenge: string = ''): string {
  const client = isDesktop ? `?client=desktop${challenge === '' ? '' : `&challenge=${challenge}`}` : ''
  return `${instanceUrl}/api/auth/oidc/${provider}/start${client}`
}

export async function openInSystemBrowser(url: string): Promise<void> {
  const { openUrl } = await import('@tauri-apps/plugin-opener')
  await openUrl(url)
}

export async function listenForHandoff(onAnswer: (answer: NonNullable<DeepLinkAnswer>) => void): Promise<() => void> {
  const { onOpenUrl } = await import('@tauri-apps/plugin-deep-link')
  return onOpenUrl((links) => {
    for (const link of links) {
      const answer = answerOfDeepLink(link)
      if (answer !== null) {
        onAnswer(answer)
      }
    }
  })
}

const VERIFIER_BYTES = 32

function base64UrlOf(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export type DesktopHandoff = {
  begin: () => Promise<string>
  accept: (answer: NonNullable<DeepLinkAnswer>) => ({ code: string; verifier: string } | { error: string }) | null
}

export function createDesktopHandoff(): DesktopHandoff {
  let verifier: string | null = null

  return {
    begin: async () => {
      verifier = base64UrlOf(crypto.getRandomValues(new Uint8Array(VERIFIER_BYTES)))
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
      return base64UrlOf(new Uint8Array(digest))
    },
    accept: (answer) => {
      if (verifier === null) {
        return null
      }
      const pending = verifier
      verifier = null
      return 'code' in answer ? { code: answer.code, verifier: pending } : { error: answer.error }
    },
  }
}
