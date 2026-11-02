export type { SessionTalker, SpokenTurn } from '../../../../contract/ConversationContract.js'

export function framedTurn(message: string, reference: string): string {
  return [
    `L architecte te repond sur ${reference} :`,
    ``,
    message,
    ``,
    `Reecris la carte si sa reponse la change, puis dis ce que tu as compris.`,
  ].join('\n')
}
