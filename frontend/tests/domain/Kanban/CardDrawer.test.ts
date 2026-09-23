import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import CardDrawer from '@/domain/Kanban/CardDrawer.vue'
import type { ProjectCard } from '@/domain/Board/BoardModel'

const send = vi.fn().mockResolvedValue({})

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: vi.fn().mockResolvedValue(null),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

function story(over: Partial<ProjectCard> = {}): ProjectCard {
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

function mounted(props: { story: ProjectCard; hold: null }) {
  return mount(CardDrawer, {
    props,
    global: {
      plugins: [createBoardI18n('fr')],
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        ThreadTab: true,
        StoryTab: true,
        PlanTab: true,
        ReviewTab: true,
        DeliveryTab: true,
        DiscussionTab: true,
      },
    },
  })
}

describe('CardDrawer bloque et debloque une story a la main', () => {
  it('propose un champ de raison quand la story n est pas bloquee', () => {
    const drawer = mounted({ story: story(), hold: null })

    const field = drawer.find('#blocked-reason')
    expect(field.exists()).toBe(true)
    expect(drawer.find(`label[for="blocked-reason"]`).exists()).toBe(true)
  })

  it('envoie la raison saisie pour bloquer la story', async () => {
    const drawer = mounted({ story: story(), hold: null })

    await drawer.find('#blocked-reason').setValue('on attend une decision produit')
    await drawer.find('form').trigger('submit')

    expect(send).toHaveBeenCalledWith('/api/stories/1/block', 'POST', {
      reason: 'on attend une decision produit',
    })
  })

  it('montre la raison et le bouton debloquer quand la story est bloquee', () => {
    const drawer = mounted({ story: story({ blockedReason: 'on attend le client' }), hold: null })

    expect(drawer.text()).toContain('on attend le client')
    expect(drawer.find('#blocked-reason').exists()).toBe(false)
  })

  it('envoie la demande de deblocage', async () => {
    const drawer = mounted({ story: story({ blockedReason: 'on attend le client' }), hold: null })

    const unblockButton = drawer.findAll('button').find((button) => button.text() === 'Débloquer')
    await unblockButton?.trigger('click')

    expect(send).toHaveBeenCalledWith('/api/stories/1/block', 'DELETE')
  })
})
