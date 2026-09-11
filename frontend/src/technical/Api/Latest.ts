export type Latest = {
  claim: () => number
  isCurrent: (ticket: number) => boolean
}

export function createLatest(): Latest {
  let given = 0
  return {
    claim: () => {
      given += 1
      return given
    },
    isCurrent: (ticket) => ticket === given,
  }
}
