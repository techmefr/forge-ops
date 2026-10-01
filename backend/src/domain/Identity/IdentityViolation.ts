export class IdentityViolationError extends Error {
  protected constructor(message: string, name: string) {
    super(message)
    this.name = name
  }
}

export class PasswordRefusedError extends IdentityViolationError {
  constructor(reason: string) {
    super(`Password refused: ${reason}`, 'PasswordRefusedError')
  }
}

export class LoginTakenError extends IdentityViolationError {
  constructor(login: string) {
    super(`Account ${login} already exists`, 'LoginTakenError')
  }
}

export class LoginRefusedError extends IdentityViolationError {
  constructor() {
    super('Invalid login or password', 'LoginRefusedError')
  }
}

export class AccountDisabledError extends IdentityViolationError {
  constructor(login: string) {
    super(`Account ${login} is disabled`, 'AccountDisabledError')
  }
}

export class EmailTakenError extends IdentityViolationError {
  constructor() {
    super('This address cannot be used', 'EmailTakenError')
  }
}

export class LastSuperAdminError extends IdentityViolationError {
  constructor() {
    super('The last super admin cannot lose the flag: name another one first', 'LastSuperAdminError')
  }
}

export class UnknownAccountError extends IdentityViolationError {
  constructor(login: string) {
    super(`Account ${login} not found`, 'UnknownAccountError')
  }
}

export class ExternalSubjectTakenError extends IdentityViolationError {
  constructor(login: string) {
    super(`Account ${login} is already linked to an external identity`, 'ExternalSubjectTakenError')
  }
}
