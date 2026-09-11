import { WRITE_TOOL_MATCHER } from '../../domain/Agent/ToolName.js'

const HOOK_TIMEOUT_SECONDS = 2

export type HookSettingsInput = {
  port: number
  token: string
}

export function buildHookSettings({ port, token }: HookSettingsInput): Record<string, unknown> {
  return {
    hooks: {
      PostToolUse: [
        {
          matcher: WRITE_TOOL_MATCHER,
          hooks: [
            {
              type: 'http',
              url: `http://127.0.0.1:${port}/api/hooks`,
              headers: { 'x-forge-token': token },
              timeout: HOOK_TIMEOUT_SECONDS,
            },
          ],
        },
      ],
    },
  }
}
