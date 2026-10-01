export abstract class AgentViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class UnknownAgentSessionError extends AgentViolationError {
  constructor(claudeSessionId: string) {
    super(`No agent session recorded for ${claudeSessionId}`, 'UnknownAgentSessionError')
  }
}
