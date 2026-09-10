import { ref, watchEffect, type Ref } from 'vue'
import {
  FACE_STORAGE_KEY,
  FONT_FACES,
  FONT_SCALES,
  SCALE_STORAGE_KEY,
  fontStackOf,
  rootSizeOf,
  type FontFace,
  type FontScale,
} from './Appearance.js'
import { readPreference, writePreference } from './Preference.js'

const face = ref<FontFace>('house')

const scale = ref<FontScale>('normal')

let started = false

export type AppearanceDesk = {
  face: Ref<FontFace>
  scale: Ref<FontScale>
  selectFace: (next: FontFace) => void
  selectScale: (next: FontScale) => void
}

export function useAppearance(): AppearanceDesk {
  if (!started) {
    started = true
    face.value = readPreference(FACE_STORAGE_KEY, FONT_FACES, 'house')
    scale.value = readPreference(SCALE_STORAGE_KEY, FONT_SCALES, 'normal')
    watchEffect(() => {
      const root = document.documentElement
      root.style.setProperty('--forge-font-body', fontStackOf(face.value))
      root.style.fontSize = `${rootSizeOf(scale.value)}px`
    })
  }

  return {
    face,
    scale,
    selectFace: (next) => {
      face.value = next
      writePreference(FACE_STORAGE_KEY, next)
    },
    selectScale: (next) => {
      scale.value = next
      writePreference(SCALE_STORAGE_KEY, next)
    },
  }
}
