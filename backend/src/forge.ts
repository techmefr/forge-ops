import { defaultBoardServerInput, startBoardServer } from './composition/BoardServer.js'
import { closeOnSignals } from './technical/Http/Shutdown.js'
import { complaintOf, saidAloud, startsAnyway } from './domain/Instance/InstanceVolume.js'
import { readVolume } from './technical/Instance/VolumeReader.js'

const input = defaultBoardServerInput()

const volume = readVolume(input.dbPath)
const complaint = complaintOf(volume)
if (complaint !== null) {
  console.log(saidAloud(volume, complaint))
  if (!startsAnyway(complaint)) {
    process.exit(1)
  }
}

const board = await startBoardServer(input)

closeOnSignals(board)

console.log(`Board forge en ecoute sur http://forge.localhost:${board.port}`)
console.log(`Base ${input.dbPath}, daemon lu dans ${input.claudeHome}`)
