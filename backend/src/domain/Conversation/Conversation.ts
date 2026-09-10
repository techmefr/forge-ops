export type SpokenTurn = {
  claudeSessionId: string
  reference: string
  message: string
}

export type SessionTalker = {
  say: (turn: SpokenTurn) => Promise<void>
  hangUp: (claudeSessionId: string) => void
}

export function framedTurn(message: string, reference: string): string {
  return [
    `L architecte te repond sur ${reference} :`,
    ``,
    message,
    ``,
    `Reecris la carte si sa reponse la change, puis dis ce que tu as compris.`,
  ].join('\n')
}
