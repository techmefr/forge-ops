import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import type * as VueRouter from 'vue-router'
import { createBoardI18n } from '@/technical/Language/I18n'
import LoginScreen from '@/domain/Access/LoginScreen.vue'
import { HOME_PATH } from '@/technical/Router/Screen'

const read = vi.fn()
const send = vi.fn()
const push = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof VueRouter>()
  return { ...actual, useRouter: () => ({ push }) }
})

function mounted() {
  return mount(LoginScreen, {
    global: { plugins: [createBoardI18n('fr')] },
  })
}

function onPath(path: string, response: unknown): void {
  read.mockImplementation((requested: string) =>
    requested === path ? Promise.resolve(response) : Promise.resolve({}),
  )
}

describe("l'ecran de connexion saute le jeton en local quand l'origine est locale", () => {
  beforeEach(() => {
    read.mockReset()
    send.mockReset()
    push.mockReset()
  })

  it("ouvre la session toute seule et part sans jamais montrer le champ jeton", async () => {
    onPath('/api/board/mode', { mode: 'local', localTrusted: true })
    send.mockResolvedValue({ expiresAt: new Date().toISOString() })

    const screen = mounted()
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/auth/session/local', 'POST')
    expect(push).toHaveBeenCalledWith(HOME_PATH)
    expect(screen.find('input[type="password"]').exists()).toBe(false)
  })

  it("montre quand meme le champ jeton si l'auto-connexion echoue", async () => {
    onPath('/api/board/mode', { mode: 'local', localTrusted: true })
    send.mockRejectedValue(new Error('refuse'))

    const screen = mounted()
    await flushPromises()

    expect(screen.find('input[type="password"]').exists()).toBe(true)
  })

  it("ne tente pas l'auto-connexion quand l'origine n'est pas locale", async () => {
    onPath('/api/board/mode', { mode: 'local', localTrusted: false })

    const screen = mounted()
    await flushPromises()

    expect(send).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(screen.find('input[type="password"]').exists()).toBe(true)
  })

  it('ne tente jamais le raccourci en mode hub, meme si le drapeau local est vrai', async () => {
    onPath('/api/board/mode', { mode: 'hub', localTrusted: true })
    onPath('/api/auth/state', { users: 1, enrolmentOpen: false })

    const screen = mounted()
    await flushPromises()

    expect(send).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(screen.text()).toBeTruthy()
  })
})
