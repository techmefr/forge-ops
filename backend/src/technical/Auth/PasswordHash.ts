import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'scrypt'
const SALT_BYTES = 16
const KEY_BYTES = 64
const COST = 16384

export class PasswordUnhashableError extends Error {
  constructor(reason: string) {
    super(`Mot de passe non condensable : ${reason}`)
    this.name = 'PasswordUnhashableError'
  }
}

export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 256

export function hashPassword(password: string): string {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordUnhashableError(
      `il faut de ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres`,
    )
  }
  const salt = randomBytes(SALT_BYTES)
  const key = scryptSync(password, salt, KEY_BYTES, { N: COST })
  return [ALGORITHM, COST, salt.toString('hex'), key.toString('hex')].join('$')
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, cost, salt, key] = stored.split('$')
  if (algorithm !== ALGORITHM || cost === undefined || salt === undefined || key === undefined) {
    return false
  }
  const parsedCost = Number(cost)
  if (!Number.isInteger(parsedCost) || parsedCost <= 0) {
    return false
  }
  try {
    const expected = Buffer.from(key, 'hex')
    const offered = scryptSync(password, Buffer.from(salt, 'hex'), expected.length, { N: parsedCost })
    return timingSafeEqual(offered, expected)
  } catch {
    return false
  }
}
