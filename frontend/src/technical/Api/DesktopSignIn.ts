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

export function startUrlOf(instanceUrl: string, provider: string, isDesktop: boolean): string {
  const client = isDesktop ? '?client=desktop' : ''
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
