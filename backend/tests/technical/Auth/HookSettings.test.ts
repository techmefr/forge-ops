import { describe, expect, it } from 'vitest'
import { buildHookSettings } from '../../../src/technical/Auth/HookSettings.js'

const TOKEN = 'f'.repeat(64)

describe('buildHookSettings', () => {
  it('points the hook at the board intake', () => {
    const settings = buildHookSettings({ port: 8830, token: TOKEN })

    expect(JSON.stringify(settings)).toContain('http://127.0.0.1:8830/api/hooks')
  })

  it('never writes the token into the url', () => {
    const settings = buildHookSettings({ port: 8830, token: TOKEN }) as {
      hooks: { PostToolUse: { hooks: { url: string }[] }[] }
    }

    expect(settings.hooks.PostToolUse[0]?.hooks[0]?.url).not.toContain(TOKEN)
  })

  it('hands the token over in a header', () => {
    const settings = buildHookSettings({ port: 8830, token: TOKEN }) as {
      hooks: { PostToolUse: { hooks: { headers: Record<string, string> }[] }[] }
    }

    expect(settings.hooks.PostToolUse[0]?.hooks[0]?.headers).toEqual({ 'x-forge-token': TOKEN })
  })

  it('declares the hook on the tools that touch a file', () => {
    const settings = buildHookSettings({ port: 8830, token: TOKEN })

    expect(JSON.stringify(settings)).toContain('Write|Edit|MultiEdit|NotebookEdit')
  })

  it('declares it as a PostToolUse http hook', () => {
    const settings = buildHookSettings({ port: 8830, token: TOKEN }) as {
      hooks: { PostToolUse: { hooks: { type: string }[] }[] }
    }

    expect(settings.hooks.PostToolUse[0]?.hooks[0]?.type).toBe('http')
  })

  it('carries nothing but the hook, so it never shadows another setting', () => {
    const settings = buildHookSettings({ port: 8830, token: TOKEN })

    expect(Object.keys(settings)).toEqual(['hooks'])
  })

  it('follows the port it was given', () => {
    const settings = buildHookSettings({ port: 9001, token: TOKEN })

    expect(JSON.stringify(settings)).toContain('127.0.0.1:9001')
  })
})
