import type Database from 'better-sqlite3'
import type { BoardUser, SuperAdminSeed, ExternalUserDraft, UserDraft } from './Identity.js'
import { createIdentityAccountChanges } from './IdentityAccountChanges.js'
import { createIdentityEnrolment } from './IdentityEnrolment.js'
import { createIdentityErasure } from './IdentityErasure.js'
import { createIdentityLookups } from './IdentityLookups.js'
import { prepareIdentityStatements } from './IdentityStatements.js'
import { createSessionStore, type SessionStore } from './SessionStore.js'

export type IdentityClock = () => number

export type IdentityRepositoryInput = {
  clock?: IdentityClock
}

export type IdentityRepository = Omit<SessionStore, 'revokeSessionsOf'> & {
  enrolUser: (draft: UserDraft) => BoardUser
  disableUser: (login: string) => void
  countUsers: () => number
  countSuperAdmins: () => number
  bootstrapSuperAdmin: (seed: SuperAdminSeed) => BoardUser
  changeSuperAdmin: (login: string, superAdmin: boolean) => BoardUser
  changeActive: (login: string, active: boolean) => BoardUser
  eraseUser: (login: string) => BoardUser
  changeCapacity: (login: string, capacity: number | null) => BoardUser
  listUsers: () => readonly BoardUser[]
  findUser: (login: string) => BoardUser | null
  changeEmail: (login: string, email: string) => BoardUser
  changeDisplayName: (login: string, displayName: string) => BoardUser
  changePassword: (login: string, current: string, next: string) => void
  findUserByExternalSubject: (subject: string) => BoardUser | null
  findUserByEmail: (email: string) => BoardUser | null
  findVerifiedUserByEmail: (email: string) => BoardUser | null
  verifyEmail: (login: string) => BoardUser
  linkExternalSubject: (login: string, subject: string) => BoardUser
  enrolExternalUser: (draft: ExternalUserDraft) => BoardUser
}

export function createIdentityRepository(
  db: Database.Database,
  { clock = Date.now }: IdentityRepositoryInput = {},
): IdentityRepository {
  const sessions = createSessionStore(db, { clock })
  const statements = prepareIdentityStatements(db)
  const lookups = createIdentityLookups(statements)
  return {
    openSession: sessions.openSession,
    openSessionFor: sessions.openSessionFor,
    readSession: sessions.readSession,
    closeSession: sessions.closeSession,
    findUser: lookups.findUser,
    findUserByExternalSubject: lookups.findUserByExternalSubject,
    findUserByEmail: lookups.findUserByEmail,
    findVerifiedUserByEmail: lookups.findVerifiedUserByEmail,
    listUsers: lookups.listUsers,
    countUsers: lookups.countUsers,
    countSuperAdmins: lookups.activeSuperAdmins,
    ...createIdentityEnrolment(statements, lookups),
    ...createIdentityAccountChanges(statements, lookups, sessions),
    ...createIdentityErasure(db, lookups),
  }
}
