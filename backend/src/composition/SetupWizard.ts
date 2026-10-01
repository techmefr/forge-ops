import * as prompts from '@clack/prompts'
import {
  TOPOLOGIES,
  composeFileOf,
  envLinesOf,
  generatedSecretsOf,
  hasAccounts,
  isHttpUrl,
  oidcSecretFilesOf,
  isSpecificTenant,
  redirectUriOf,
  validateAnswers,
  type MicrosoftChoice,
  type OidcChoice,
  type SetupAnswers,
  type Topology,
} from '../domain/Setup/SetupPlan.js'
import { newSecret, writeEnvFile, writeSecretOnce } from '../technical/Setup/SetupFiles.js'

const TOPOLOGY_LABELS: Readonly<Record<Topology, string>> = {
  laptop: 'Everything on this laptop (try it in ten minutes)',
  vps: 'Everything on a VPS (shared board, accounts, agents)',
  split: 'Instance here, server on a VPS',
  hosted: 'Hosted server, my own instance',
}

function sure<T>(answer: T | symbol): T {
  if (prompts.isCancel(answer)) {
    prompts.cancel('Setup cancelled, nothing was written.')
    process.exit(0)
  }
  return answer as T
}

async function ask(message: string, placeholder = '', validate?: (value: string) => string | undefined): Promise<string> {
  return sure(await prompts.text({ message, placeholder, validate: (value) => validate?.(value ?? '') })).trim()
}

async function askOidc(name: string, origin: string, provider: 'google' | 'microsoft'): Promise<OidcChoice | null> {
  if (!sure(await prompts.confirm({ message: `Enable sign-in with ${name}?`, initialValue: false }))) {
    return null
  }
  prompts.note(`Register this redirect URI at ${name}:\n${redirectUriOf(origin, provider)}`, `${name} redirect URI`)
  const clientId = await ask(`${name} client id`, '', (value) => (value === '' ? 'required' : undefined))
  const clientSecret = sure(await prompts.password({ message: `${name} client secret` }))
  return { clientId, clientSecret }
}

async function askMicrosoft(origin: string): Promise<MicrosoftChoice | null> {
  const base = await askOidc('Microsoft', origin, 'microsoft')
  if (base === null) {
    return null
  }
  const tenant = await ask('Microsoft tenant id (a uuid, not common)', '', (value) =>
    isSpecificTenant(value) ? undefined : 'a specific tenant id is required',
  )
  return { ...base, tenant }
}

export async function askAnswers(): Promise<SetupAnswers> {
  const topology = sure(
    await prompts.select({
      message: 'Where should the agents run?',
      options: TOPOLOGIES.map((value) => ({ value, label: TOPOLOGY_LABELS[value] })),
    }),
  )
  const repositories = await ask('Folder holding your repositories (empty for ./repositories)')
  const base: SetupAnswers = {
    topology,
    publicInstanceUrl: '',
    serverUrl: '',
    superAdminLogin: '',
    repositories,
    allowedDomains: [],
    google: null,
    microsoft: null,
  }
  if (topology === 'split' || topology === 'hosted') {
    const serverUrl = await ask('Address of the board server', 'https://board.example.com', (value) =>
      isHttpUrl(value) ? undefined : 'start with http:// or https://',
    )
    return { ...base, serverUrl }
  }
  if (!hasAccounts(topology) || topology === 'laptop') {
    return base
  }
  const publicInstanceUrl = await ask('Public address of the instance', 'https://forge.example.com', (value) =>
    isHttpUrl(value) ? undefined : 'start with http:// or https://',
  )
  const superAdminLogin = await ask('Login of the first super admin', 'admin')
  const domains = await ask('Email domains allowed to create an account on first sign-in (comma separated, optional)')
  return {
    ...base,
    publicInstanceUrl,
    superAdminLogin,
    allowedDomains: domains.split(',').map((domain) => domain.trim().toLowerCase()).filter((domain) => domain !== ''),
    google: await askOidc('Google', publicInstanceUrl, 'google'),
    microsoft: await askMicrosoft(publicInstanceUrl),
  }
}

export type SetupResult = {
  composeFile: string
  adminPassword: string | null
}

export function applyAnswers(answers: SetupAnswers, directory: string): SetupResult {
  const problems = validateAnswers(answers)
  if (problems.length > 0) {
    throw new Error(problems.join('; '))
  }
  let adminPassword: string | null = null
  for (const name of generatedSecretsOf(answers.topology)) {
    const value = newSecret()
    const isWritten = writeSecretOnce(directory, name, value)
    if (isWritten && name === 'super_admin_password') {
      adminPassword = value
    }
  }
  for (const secret of oidcSecretFilesOf(answers)) {
    writeSecretOnce(directory, secret.name, secret.value)
  }
  writeEnvFile(directory, envLinesOf(answers))
  return { composeFile: composeFileOf(answers.topology), adminPassword }
}
