import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import ColumnPanel from '@/domain/Template/ColumnPanel.vue'
import type { ColumnTemplate } from '@/domain/Board/BoardModel'

const send = vi.fn().mockResolvedValue({})

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: vi.fn().mockResolvedValue([]),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

function template(): ColumnTemplate {
  return {
    id: 1,
    slug: 'shipped',
    name: 'Forge',
    version: 3,
    isDefault: true,
    columns: [
      { state: 'backlog', label: 'Reserve', colour: 'line', agent: null, prompt: null, delayHours: null },
      { state: 'architecture', label: 'Plan', colour: 'info', agent: 'architect', prompt: null, delayHours: null },
      { state: 'building', label: 'Dev', colour: 'acc', agent: null, prompt: null, delayHours: null },
    ],
  }
}

function mounted(stage: string, maySettle: boolean) {
  return mount(ColumnPanel, {
    props: { template: template(), stage, maySettle },
    global: { plugins: [createBoardI18n('fr')] },
  })
}

describe('le panneau de colonne edite le nom et la couleur', () => {
  it('propose les champs de nom et de couleur pour un admin', () => {
    const panel = mounted('architecture', true)

    expect(panel.find('input[type="text"]').exists()).toBe(true)
    expect(panel.find('select').exists()).toBe(true)
  })

  it('cache les champs a qui ne regle pas', () => {
    const panel = mounted('architecture', false)

    expect(panel.find('select').exists()).toBe(false)
  })

  it('ecrit la colonne renommee et recoloree', async () => {
    const panel = mounted('building', true)
    const nameField = panel.find('input[type="text"]')
    await nameField.setValue('Construction')
    await panel.find('select').setValue('violet')

    const writeButton = panel
      .findAll('button')
      .find((button) => button.text().includes('Écrire une version'))
    await writeButton?.trigger('click')

    expect(send).toHaveBeenCalledWith(
      '/api/templates',
      'POST',
      expect.objectContaining({
        columns: expect.arrayContaining([
          expect.objectContaining({ state: 'building', label: 'Construction', colour: 'violet' }),
        ]),
      }),
    )
  })
})

describe('le panneau de colonne reordonne les colonnes', () => {
  it('refuse de deplacer a gauche la premiere colonne', () => {
    const panel = mounted('backlog', true)

    const left = panel.find('[aria-label="Déplacer à gauche"]')
    expect(left.attributes('disabled')).toBeDefined()
  })

  it('refuse de deplacer a droite la derniere colonne', () => {
    const panel = mounted('building', true)

    const right = panel.find('[aria-label="Déplacer à droite"]')
    expect(right.attributes('disabled')).toBeDefined()
  })

  it('echange la colonne avec sa voisine de droite', async () => {
    const panel = mounted('architecture', true)

    await panel.find('[aria-label="Déplacer à droite"]').trigger('click')

    expect(send).toHaveBeenCalledWith(
      '/api/templates',
      'POST',
      expect.objectContaining({
        columns: [
          expect.objectContaining({ state: 'backlog' }),
          expect.objectContaining({ state: 'building' }),
          expect.objectContaining({ state: 'architecture' }),
        ],
      }),
    )
  })
})
