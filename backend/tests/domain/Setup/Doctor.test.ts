import { describe, expect, it } from 'vitest'
import { diagnose } from '../../../src/technical/Setup/Doctor.js'

describe('diagnose', () => {
  it('signale ce qui manque avec une piste', async () => {
    const checks = await diagnose({
      run: async (_command, args) => args[0] !== 'info',
      hasSecret: (name) => name === 'board_token',
      isHealthy: async () => false,
      secrets: ['board_token', 'instance_token'],
      healthUrl: 'http://localhost:4311/health',
    })
    const broken = checks.filter((check) => !check.isOk).map((check) => check.label)
    expect(broken).toEqual([
      'the docker daemon answers',
      'secret instance_token exists',
      'the instance answers on http://localhost:4311/health',
    ])
    expect(checks.every((check) => check.hint !== '')).toBe(true)
  })

  it('ne dit rien quand tout va bien', async () => {
    const checks = await diagnose({
      run: async () => true,
      hasSecret: () => true,
      isHealthy: async () => true,
      secrets: ['board_token'],
      healthUrl: 'http://localhost:4311/health',
    })
    expect(checks.every((check) => check.isOk)).toBe(true)
  })
})
