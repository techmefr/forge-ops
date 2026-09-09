export class IdentityViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class PasswordRefusedError extends IdentityViolationError {
  constructor(reason: string) {
    super(`Mot de passe refuse : ${reason}`, 'PasswordRefusedError')
  }
}

export class LoginTakenError extends IdentityViolationError {
  constructor(login: string) {
    super(`Le compte ${login} existe deja`, 'LoginTakenError')
  }
}

export class LoginRefusedError extends IdentityViolationError {
  constructor() {
    super('Identifiant ou mot de passe invalide', 'LoginRefusedError')
  }
}

export class AccountDisabledError extends IdentityViolationError {
  constructor(login: string) {
    super(`Le compte ${login} est desactive`, 'AccountDisabledError')
  }
}
