import type { CodexTranscriptStore } from '../Codex/CodexTranscriptStore.js'

export function promptWithReplay(
  order: { prompt: string; resumeSessionId?: string },
  transcripts: CodexTranscriptStore,
): string {
  if (order.resumeSessionId === undefined) {
    return order.prompt
  }
  const priorTranscript = transcripts.read(order.resumeSessionId)
  return priorTranscript === null ? order.prompt : `${priorTranscript}\n\n## Tour actuel\n${order.prompt}`
}
