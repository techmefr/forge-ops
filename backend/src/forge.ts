import { defaultBoardServerInput, startBoardServer } from './technical/Http/BoardServer.js'
import { closeOnSignals } from './technical/Http/Shutdown.js'

const input = defaultBoardServerInput()
const board = await startBoardServer(input)

closeOnSignals(board)

console.log(`Board forge en ecoute sur http://localhost:${board.port}`)
console.log(`Base ${input.dbPath}, daemon lu dans ${input.claudeHome}`)
