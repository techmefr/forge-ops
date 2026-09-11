import { rotateBoardToken } from './technical/Auth/BoardToken.js'
import { buildRotationReport } from './technical/Auth/RotationReport.js'
import { defaultBoardServerInput } from './composition/BoardServer.js'

const { tokenPath } = defaultBoardServerInput()

rotateBoardToken(tokenPath)

for (const line of buildRotationReport({ tokenPath })) {
  process.stdout.write(`${line}\n`)
}
