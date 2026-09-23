import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import KanbanScreen from '@/domain/Kanban/KanbanScreen.vue'
import type { ProjectCard } from '@/domain/Board/BoardModel'

const read = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: vi.fn(),
  },
}))

function card(over: Partial<ProjectCard> = {}): ProjectCard {
  return {
    id: 1,
    epicId: 1,
    twinOfStoryId: null,
    reference: 'FRG-1',
    title: 'une story',
    body: 'un corps',
    kind: 'functional',
    state: 'building',
    points: null,
    rolloutPercent: null,
    mergeConflict: false,
    escalationReason: null,
    blockedReason: null,
    usage: { costUsd: 0, inputTokens: 0, outputTokens: 0 },
    blockers: [],
    context: null,
    activity: [],
    projectSlug: 'forge',
    projectColour: 'acc',
    epicTitle: 'une epique',
    holder: null,
    milestone: null,
    daysLeft: null,
    attention: null,
    ...over,
  }
}

function onPath(responses: Record<string, unknown>): void {
  read.mockImplementation((path: string) => Promise.resolve(responses[path] ?? []))
}

function mounted() {
  return mount(KanbanScreen, {
    global: {
      plugins: [createBoardI18n('fr')],
      stubs: { CardDrawer: true, ColumnPanel: true },
    },
  })
}

describe('KanbanScreen montre la raison du blocage sur la carte', () => {
  it('affiche la raison du blocage manuel directement sur la carte', async () => {
    onPath({
      '/api/board/columns': [{ key: 'building', label: 'Dev', colour: 'acc' }],
      '/api/board/projects': [card({ attention: 'blocked', blockedReason: 'on attend le client' })],
      '/api/board/holds': [],
    })

    const screen = mounted()
    await flushPromises()

    expect(screen.text()).toContain('on attend le client')
  })

  it("n'affiche aucune raison quand la story n'est pas bloquee", async () => {
    onPath({
      '/api/board/columns': [{ key: 'building', label: 'Dev', colour: 'acc' }],
      '/api/board/projects': [card()],
      '/api/board/holds': [],
    })

    const screen = mounted()
    await flushPromises()

    expect(screen.find('.text-orange').exists()).toBe(false)
  })
})
