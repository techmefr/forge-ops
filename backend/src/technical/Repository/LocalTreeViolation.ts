export class PathOutsideCheckoutError extends Error {
  readonly asked: string

  constructor(asked: string) {
    super(`Path ${asked} is outside the checkout`)
    this.name = 'PathOutsideCheckoutError'
    this.asked = asked
  }
}

export class CheckoutUnreadableError extends Error {
  readonly path: string

  constructor(path: string, code: string) {
    super(`Checkout unreadable at ${path} (${code})`)
    this.name = 'CheckoutUnreadableError'
    this.path = path
  }
}

export class SensitivePathError extends Error {
  readonly asked: string

  constructor(asked: string) {
    super(`Path ${asked} is not served`)
    this.name = 'SensitivePathError'
    this.asked = asked
  }
}
