export const THEME_NAMES = ['volt', 'dracula', 'nord', 'gruvbox', 'tokyo', 'solarized'] as const

export type ThemeName = (typeof THEME_NAMES)[number]

export type ThemeMode = 'dark' | 'light'

export const SURFACE_KEYS = ['deep', 'panel', 'card', 'elev', 'line', 'ink'] as const

export const TEXT_KEYS = ['txtHi', 'txtMid', 'txtLow'] as const

export const ACCENT_KEYS = [
  'acc',
  'accSoft',
  'accDeep',
  'info',
  'violet',
  'violetSoft',
  'green',
  'greenSoft',
  'red',
  'redSoft',
  'orange',
  'orangeAlt',
  'warn',
  'warnSoft',
] as const

export type SurfaceKey = (typeof SURFACE_KEYS)[number]

export type TextKey = (typeof TEXT_KEYS)[number]

export type AccentKey = (typeof ACCENT_KEYS)[number]

export type PaletteKey = SurfaceKey | TextKey | AccentKey

export type Palette = Record<PaletteKey, string>

export const MINIMUM_CONTRAST_RATIO = 4.6

const BASE_PALETTES: Record<ThemeName, Palette> = {
  volt: {
    deep: '#07070A',
    panel: '#0C0C12',
    card: '#0E0E15',
    elev: '#16161E',
    line: '#1E1E27',
    ink: '#0A0A0C',
    txtHi: '#F4F4F6',
    txtMid: '#A6A6B4',
    txtLow: '#7C7C8A',
    acc: '#D6FF2B',
    accSoft: '#EAFF7A',
    accDeep: '#9BE000',
    info: '#00E0FF',
    violet: '#8B5CFF',
    violetSoft: '#C3AEFF',
    green: '#22E67A',
    greenSoft: '#7DF0AE',
    red: '#FF2D55',
    redSoft: '#FF7A93',
    orange: '#FF6B00',
    orangeAlt: '#FF8A00',
    warn: '#FFB020',
    warnSoft: '#FFB98A',
  },
  dracula: {
    deep: '#191A21',
    panel: '#21222C',
    card: '#282A36',
    elev: '#343746',
    line: '#44475A',
    ink: '#191A21',
    txtHi: '#F8F8F2',
    txtMid: '#BFC7D5',
    txtLow: '#8B9AD4',
    acc: '#BD93F9',
    accSoft: '#D6BBFF',
    accDeep: '#9A6EF0',
    info: '#8BE9FD',
    violet: '#FF79C6',
    violetSoft: '#FFA6DA',
    green: '#50FA7B',
    greenSoft: '#9BFFB5',
    red: '#FF5555',
    redSoft: '#FF9090',
    orange: '#FFB86C',
    orangeAlt: '#FF9E4A',
    warn: '#F1FA8C',
    warnSoft: '#F6FCB8',
  },
  nord: {
    deep: '#242933',
    panel: '#2E3440',
    card: '#3B4252',
    elev: '#434C5E',
    line: '#4C566A',
    ink: '#242933',
    txtHi: '#ECEFF4',
    txtMid: '#D8DEE9',
    txtLow: '#A6B3C9',
    acc: '#88C0D0',
    accSoft: '#A9D3DE',
    accDeep: '#5E9CB0',
    info: '#81A1C1',
    violet: '#B48EAD',
    violetSoft: '#D0B6CB',
    green: '#A3BE8C',
    greenSoft: '#C3D6B3',
    red: '#BF616A',
    redSoft: '#D48A91',
    orange: '#D08770',
    orangeAlt: '#E09A83',
    warn: '#EBCB8B',
    warnSoft: '#F2DEB5',
  },
  gruvbox: {
    deep: '#1D2021',
    panel: '#282828',
    card: '#32302F',
    elev: '#3C3836',
    line: '#504945',
    ink: '#1D2021',
    txtHi: '#FBF1C7',
    txtMid: '#D5C4A1',
    txtLow: '#A89984',
    acc: '#FABD2F',
    accSoft: '#FCD675',
    accDeep: '#D79921',
    info: '#83A598',
    violet: '#D3869B',
    violetSoft: '#E5AFBF',
    green: '#B8BB26',
    greenSoft: '#D2D46B',
    red: '#FB4934',
    redSoft: '#FD8A7C',
    orange: '#FE8019',
    orangeAlt: '#D65D0E',
    warn: '#FABD2F',
    warnSoft: '#FCD675',
  },
  tokyo: {
    deep: '#16161E',
    panel: '#1A1B26',
    card: '#24283B',
    elev: '#2F334D',
    line: '#414868',
    ink: '#16161E',
    txtHi: '#C0CAF5',
    txtMid: '#A9B1D6',
    txtLow: '#98A2C6',
    acc: '#7AA2F7',
    accSoft: '#A9C1FA',
    accDeep: '#5A7FD6',
    info: '#7DCFFF',
    violet: '#BB9AF7',
    violetSoft: '#D3BDFA',
    green: '#9ECE6A',
    greenSoft: '#C0E09B',
    red: '#F7768E',
    redSoft: '#FAA3B3',
    orange: '#FF9E64',
    orangeAlt: '#E0AF68',
    warn: '#E0AF68',
    warnSoft: '#EDCF9C',
  },
  solarized: {
    deep: '#002B36',
    panel: '#073642',
    card: '#0B4451',
    elev: '#145A67',
    line: '#1F6E7B',
    ink: '#002B36',
    txtHi: '#FDF6E3',
    txtMid: '#AEBCBC',
    txtLow: '#9FB0B1',
    acc: '#B58900',
    accSoft: '#D4A72C',
    accDeep: '#8F6D00',
    info: '#268BD2',
    violet: '#6C71C4',
    violetSoft: '#9296D8',
    green: '#859900',
    greenSoft: '#A8B93C',
    red: '#DC322F',
    redSoft: '#E96B69',
    orange: '#CB4B16',
    orangeAlt: '#D9701F',
    warn: '#B58900',
    warnSoft: '#D4A72C',
  },
}

export const THEME_LABELS: Record<ThemeName, string> = {
  volt: 'Volt',
  dracula: 'Dracula',
  nord: 'Nord',
  gruvbox: 'Gruvbox',
  tokyo: 'Tokyo Night',
  solarized: 'Solarized',
}

function channels(hex: string): readonly [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function toHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

export function mixColours(from: string, towards: string, weight: number): string {
  const source = channels(from)
  const target = channels(towards)
  const blended = source.map((channel, index) =>
    Math.round(channel * (1 - weight) + (target[index] ?? 0) * weight),
  )
  return toHex(blended[0] ?? 0, blended[1] ?? 0, blended[2] ?? 0)
}

function relativeLuminance(hex: string): number {
  const [red, green, blue] = channels(hex)
  const linear = [red, green, blue].map((channel) => {
    const ratio = channel / 255
    return ratio <= 0.03928 ? ratio / 12.92 : Math.pow((ratio + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0)
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second))
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second))
  return (lighter + 0.05) / (darker + 0.05)
}

const LIGHT_ACCENT_DARKENING = 0.56

const LIGHT_SURFACE_TINTS: Record<Exclude<SurfaceKey, 'panel' | 'ink'>, number> = {
  deep: 0.94,
  card: 0.965,
  elev: 0.92,
  line: 0.8,
}

const LIGHT_TEXT: Record<TextKey, string> = {
  txtHi: '#141419',
  txtMid: '#3E3E4A',
  txtLow: '#55555F',
}

const LIFT_STEP = 0.1

const LIFT_LIMIT = 60

function liftUntilReadable(colour: string, background: string, towards: string): string {
  let lifted = colour
  let step = 0
  while (contrastRatio(lifted, background) < MINIMUM_CONTRAST_RATIO && step < LIFT_LIMIT) {
    lifted = mixColours(lifted, towards, LIFT_STEP)
    step += 1
  }
  return lifted
}

function toLightPalette(base: Palette): Palette {
  const palette: Palette = { ...base }
  for (const key of ACCENT_KEYS) {
    palette[key] = mixColours(base[key], '#000000', LIGHT_ACCENT_DARKENING)
  }
  palette.panel = '#ffffff'
  palette.ink = '#ffffff'
  for (const [key, tint] of Object.entries(LIGHT_SURFACE_TINTS)) {
    palette[key as SurfaceKey] = mixColours(palette.acc, '#FFFFFF', tint)
  }
  for (const key of TEXT_KEYS) {
    palette[key] = LIGHT_TEXT[key]
  }
  return palette
}

export function resolvePalette(name: ThemeName, mode: ThemeMode): Palette {
  const base = BASE_PALETTES[name]
  const palette = mode === 'light' ? toLightPalette(base) : { ...base }
  const background = mode === 'light' ? palette.panel : palette.card
  const towards = mode === 'light' ? '#000000' : '#FFFFFF'
  for (const key of ACCENT_KEYS) {
    palette[key] = liftUntilReadable(palette[key], background, towards)
  }
  return palette
}

export function paletteVariables(palette: Palette): Record<string, string> {
  return Object.fromEntries(
    Object.entries(palette).map(([key, value]) => [`--forge-${key.toLowerCase()}`, value]),
  )
}
