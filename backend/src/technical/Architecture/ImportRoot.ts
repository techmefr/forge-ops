import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { LayerRoot } from './ImportDirection.js'

const here = dirname(fileURLToPath(import.meta.url))

export const REPOSITORY_ROOT = resolve(here, '..', '..', '..', '..')

export const LAYER_ROOTS: LayerRoot[] = [
  { name: 'backend/src', directory: resolve(REPOSITORY_ROOT, 'backend', 'src') },
  { name: 'frontend/src', directory: resolve(REPOSITORY_ROOT, 'frontend', 'src'), alias: '@/' },
]

export const BASELINE_PATH = resolve(here, 'ImportDirectionBaseline.json')
