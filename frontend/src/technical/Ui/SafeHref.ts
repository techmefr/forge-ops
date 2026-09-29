const SAFE_PROTOCOLS: readonly string[] = ['http:', 'https:']

export const UNSAFE_HREF = 'about:blank'

export function safeHref(url: string): string {
  try {
    return SAFE_PROTOCOLS.includes(new URL(url).protocol) ? url : UNSAFE_HREF
  } catch {
    return UNSAFE_HREF
  }
}
