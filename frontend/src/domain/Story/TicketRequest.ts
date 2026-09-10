export type TicketPoint = {
  kind: 'title' | 'body' | 'criterion' | 'gap' | 'step'
  text: string
}

const LIMIT = 120

function short(text: string): string {
  return text.length > LIMIT ? `${text.slice(0, LIMIT)}…` : text
}

export function requestFor({ kind, text }: TicketPoint): string {
  const said = short(text)
  if (kind === 'title') {
    return `Reecris le titre de la story, aujourd hui « ${said} » : `
  }
  if (kind === 'body') {
    return `Reecris le corps de la story, aujourd hui « ${said} » : `
  }
  if (kind === 'criterion') {
    return `Revois le critere « ${said} » : `
  }
  if (kind === 'gap') {
    return `Comble ce manque : ${said}. `
  }
  return `Dis-moi ce qui manque pour prouver « ${said} » : `
}
