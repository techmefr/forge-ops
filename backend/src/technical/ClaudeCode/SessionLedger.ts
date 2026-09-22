export type LedgerSession = {
  lifecycle: string
}

export type LedgerUsage = {
  costUsd: number
  inputTokens: number
  outputTokens: number
  contextTokens?: number
  contextWindow?: number
}

export type SessionLedger = {
  findByClaudeSessionId: (claudeSessionId: string) => LedgerSession | null
  updateLifecycle: (claudeSessionId: string, lifecycle: 'working' | 'awaiting_human') => void
  recordHeartbeat: (claudeSessionId: string) => void
  closeSession: (claudeSessionId: string, exit: { exitCode: number }) => void
  recordUsage: (claudeSessionId: string, usage: LedgerUsage) => void
}
