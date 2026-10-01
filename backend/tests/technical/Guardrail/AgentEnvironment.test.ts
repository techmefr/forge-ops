import { describe, expect, it } from 'vitest'
import { agentEnvironmentOf, codexAgentEnvironmentOf } from '../../../src/technical/Guardrail/AgentEnvironment.js'

const SERVER_ENV = {
  PATH: '/usr/bin',
  HOME: '/home/forge',
  LC_ALL: 'C',
  HTTPS_PROXY: 'http://proxy:3128',
  ANTHROPIC_API_KEY: 'sk-ant',
  OPENAI_API_KEY: 'sk-openai',
  FORGE_DB_PATH: '/data/forge.db',
  FORGE_STORY_REFERENCE: 'FORGE-1',
  FORGE_PHASE: 'spec',
  FORGE_SUPER_ADMIN_LOGIN: 'admin',
  FORGE_SUPER_ADMIN_PASSWORD: 'secret',
  FORGE_SUPER_ADMIN_PASSWORD_FILE: '/run/secret',
  FORGE_SETUP_TOKEN: 'setup',
  FORGE_OIDC_GOOGLE_CLIENT_ID: 'oidc',
  FORGE_TOKEN_PATH: '/data/token',
  DATABASE_URL: 'postgres://x',
}

describe('agentEnvironmentOf', () => {
  it('keeps the runtime, proxy, anthropic and hook variables', () => {
    expect(agentEnvironmentOf({ source: SERVER_ENV })).toEqual({
      PATH: '/usr/bin',
      HOME: '/home/forge',
      LC_ALL: 'C',
      HTTPS_PROXY: 'http://proxy:3128',
      ANTHROPIC_API_KEY: 'sk-ant',
      FORGE_DB_PATH: '/data/forge.db',
      FORGE_STORY_REFERENCE: 'FORGE-1',
      FORGE_PHASE: 'spec',
    })
  })

  it('strips every other forge variable and unrelated secrets', () => {
    const names = Object.keys(agentEnvironmentOf({ source: SERVER_ENV }))

    expect(names).not.toContain('FORGE_SUPER_ADMIN_PASSWORD')
    expect(names).not.toContain('FORGE_SUPER_ADMIN_PASSWORD_FILE')
    expect(names).not.toContain('FORGE_SETUP_TOKEN')
    expect(names).not.toContain('FORGE_OIDC_GOOGLE_CLIENT_ID')
    expect(names).not.toContain('FORGE_TOKEN_PATH')
    expect(names).not.toContain('DATABASE_URL')
  })

  it('drops undefined values', () => {
    expect(agentEnvironmentOf({ source: { PATH: undefined } })).toEqual({})
  })
})

describe('codexAgentEnvironmentOf', () => {
  it('adds openai variables without leaking forge secrets', () => {
    const env = codexAgentEnvironmentOf(SERVER_ENV)

    expect(env.OPENAI_API_KEY).toBe('sk-openai')
    expect(env.FORGE_SUPER_ADMIN_PASSWORD).toBeUndefined()
  })
})
