import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright-core'
import type {
  PilotDriver,
  PilotObservation,
  PilotPace,
  PilotStep,
} from '../../domain/Pilot/Pilot.js'

export const PACE_DELAY: Readonly<Record<PilotPace, number>> = {
  live: 0,
  slow: 600,
  step: 1500,
}

export const STEP_TIMEOUT = 15000

export const INSPECTION_LENGTH = 2000

export class BrowserNotOpenError extends Error {
  constructor() {
    super("le pilote n a pas de navigateur ouvert")
    this.name = 'BrowserNotOpenError'
  }
}

export class TextNotFoundError extends Error {
  constructor(target: string, wanted: string) {
    super(`${target} ne dit pas ${wanted}`)
    this.name = 'TextNotFoundError'
  }
}

export type PlaywrightPilotInput = {
  shotDir: string
  headless?: boolean
}

function isError(message: ConsoleMessage): boolean {
  return message.type() === 'error'
}

export function createPlaywrightPilot({ shotDir, headless = true }: PlaywrightPilotInput): PilotDriver {
  let browser: Browser | null = null
  let page: Page | null = null
  let errors: string[] = []
  let shots = 0

  function live(): Page {
    if (page === null) {
      throw new BrowserNotOpenError()
    }
    return page
  }

  async function shoot(): Promise<string> {
    mkdirSync(shotDir, { recursive: true })
    shots += 1
    const path = join(shotDir, `pilot-${Date.now()}-${shots}.png`)
    await live().screenshot({ path })
    return path
  }

  async function look(detail: string): Promise<PilotObservation> {
    const seen = errors
    errors = []
    return { detail, screenshotPath: await shoot(), consoleErrors: seen }
  }

  return {
    open: async (url, pace) => {
      browser = await chromium.launch({ headless, slowMo: PACE_DELAY[pace] })
      page = await browser.newPage()
      errors = []
      page.on('console', (message) => {
        if (isError(message)) {
          errors.push(message.text())
        }
      })
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })
      await page.goto(url, { timeout: STEP_TIMEOUT })
    },

    perform: async (step: PilotStep) => {
      const target = step.target ?? ''
      if (step.kind === 'goto') {
        await live().goto(target, { timeout: STEP_TIMEOUT })
        return look(`ouvert ${target}`)
      }
      if (step.kind === 'click') {
        await live().click(target, { timeout: STEP_TIMEOUT })
        return look(`clique sur ${target}`)
      }
      if (step.kind === 'fill') {
        await live().fill(target, step.value ?? '', { timeout: STEP_TIMEOUT })
        return look(`ecrit dans ${target}`)
      }
      if (step.kind === 'expectText') {
        const wanted = step.value ?? ''
        const text = await live().locator(target).first().innerText({ timeout: STEP_TIMEOUT })
        if (!text.includes(wanted)) {
          throw new TextNotFoundError(target, wanted)
        }
        return look(`${target} dit bien ${wanted}`)
      }
      return look('capture')
    },

    inspect: async () => {
      const current = live()
      const text = await current.locator('body').innerText({ timeout: STEP_TIMEOUT })
      return {
        detail: `${current.url()} : ${text.slice(0, INSPECTION_LENGTH)}`,
        screenshotPath: await shoot(),
        consoleErrors: errors,
      }
    },

    close: async () => {
      await browser?.close()
      browser = null
      page = null
    },
  }
}
