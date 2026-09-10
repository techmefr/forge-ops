export const FONT_FACES = ['house', 'system', 'serif', 'mono'] as const

export type FontFace = (typeof FONT_FACES)[number]

export const FONT_FACE_LABELS: Readonly<Record<FontFace, string>> = {
  house: 'Barlow',
  system: 'Du systeme',
  serif: 'A empattements',
  mono: 'JetBrains Mono',
}

const SYSTEM_STACK =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

const FONT_STACKS: Readonly<Record<FontFace, string>> = {
  house: `"Barlow", ${SYSTEM_STACK}`,
  system: SYSTEM_STACK,
  serif: '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}

export const FONT_SCALES = ['small', 'normal', 'large', 'huge'] as const

export type FontScale = (typeof FONT_SCALES)[number]

export const FONT_SCALE_LABELS: Readonly<Record<FontScale, string>> = {
  small: 'Serree',
  normal: 'Normale',
  large: 'Grande',
  huge: 'Tres grande',
}

const ROOT_SIZES: Readonly<Record<FontScale, number>> = {
  small: 14,
  normal: 16,
  large: 18,
  huge: 20,
}

export const FACE_STORAGE_KEY = 'forge.face'

export const SCALE_STORAGE_KEY = 'forge.scale'

export function fontStackOf(face: string): string {
  return FONT_STACKS[face as FontFace] ?? FONT_STACKS.system
}

export function rootSizeOf(scale: string): number {
  return ROOT_SIZES[scale as FontScale] ?? ROOT_SIZES.normal
}
