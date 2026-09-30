export const desktopFetch: typeof fetch = async (input, init) => {
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
  return tauriFetch(input, init)
}
