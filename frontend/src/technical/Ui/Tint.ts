import { contrastRatio } from '@/technical/Theme/Palette'

const DARK_TEXT = '#141419'

const LIGHT_TEXT = '#ffffff'

function expandHex(colour: string): string | null {
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(colour)
  if (short !== null) {
    return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  }
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour : null
}

export function textOnTint(colour: string): string {
  const hex = expandHex(colour.trim())
  if (hex === null) {
    return 'var(--forge-ink)'
  }
  return contrastRatio(hex, DARK_TEXT) >= contrastRatio(hex, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}

export function tintOf(colour: string): string {
  const named = colour.trim()
  if (named === '') {
    return 'var(--forge-line)'
  }
  return named.startsWith('#') || named.startsWith('rgb') ? named : `var(--forge-${named})`
}
