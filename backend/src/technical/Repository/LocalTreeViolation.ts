export class PathOutsideCheckoutError extends Error {
  readonly asked: string

  constructor(asked: string) {
    super(`Le chemin ${asked} sort du depot`)
    this.name = 'PathOutsideCheckoutError'
    this.asked = asked
  }
}

export class CheckoutUnreadableError extends Error {
  readonly path: string

  constructor(path: string, reason: string) {
    super(`Depot illisible en ${path} : ${reason}`)
    this.name = 'CheckoutUnreadableError'
    this.path = path
  }
}
