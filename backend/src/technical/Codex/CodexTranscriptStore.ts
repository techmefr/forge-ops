export type CodexTranscriptTurn = {
  prompt: string
  output: string
}

export type CodexTranscriptStore = {
  read: (sessionId: string) => string | null
  append: (sessionId: string, turn: CodexTranscriptTurn) => void
}

export function createCodexTranscriptStore(): CodexTranscriptStore {
  const transcripts = new Map<string, string>()

  return {
    read: (sessionId) => transcripts.get(sessionId) ?? null,

    append: (sessionId, turn) => {
      const previous = transcripts.get(sessionId) ?? ''
      const separator = previous === '' ? '' : '\n\n'
      transcripts.set(
        sessionId,
        `${previous}${separator}## Tour precedent\n${turn.prompt}\n\n${turn.output}`.trim(),
      )
    },
  }
}
