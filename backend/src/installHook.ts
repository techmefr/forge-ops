import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { deriveHookToken, resolveBoardToken } from './technical/Auth/BoardToken.js'
import { buildHookSettings } from './technical/Auth/HookSettings.js'
import { defaultBoardServerInput } from './composition/BoardServer.js'

const SETTINGS_PATH = join('.claude', 'settings.local.json')

const { port, tokenPath } = defaultBoardServerInput()
const token = deriveHookToken(resolveBoardToken(tokenPath))

mkdirSync(dirname(SETTINGS_PATH), { recursive: true })
writeFileSync(SETTINGS_PATH, `${JSON.stringify(buildHookSettings({ port, token }), null, 2)}\n`, {
  encoding: 'utf-8',
  mode: 0o600,
})

process.stdout.write(`Hook ecrit dans ${SETTINGS_PATH}, derive du jeton de ${tokenPath}.\n`)
process.stdout.write("Ce secret n'ouvre que l'entree des hooks, et jamais le reste du board.\n")
process.stdout.write('Ce fichier est gitignore : ne jamais le committer.\n')
process.stdout.write('Les hooks sont lus au demarrage : redemarre la session Claude Code.\n')
