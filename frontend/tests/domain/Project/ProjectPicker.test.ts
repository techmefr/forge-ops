import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import ProjectPicker from '@/domain/Project/ProjectPicker.vue'
import type { Project } from '@contract/StoryContract'

const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: vi.fn(),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

function project(id: number, name: string): Project {
  return { id, slug: name.toLowerCase(), name, repositoryUrl: '', integrationBranch: 'main', colour: '#ff3b00', checkoutPath: null }
}

const PROJECTS = [project(1, 'Skera'), project(2, 'Forge Ops'), project(3, 'Cloudmail')]

function mounted(props: Record<string, unknown> = {}): VueWrapper {
  return mount(ProjectPicker, {
    attachTo: document.body,
    props: { id: 'picker', projects: PROJECTS, modelValue: 1, ...props },
    global: { plugins: [createBoardI18n('en')] },
  })
}

function input(picker: VueWrapper) {
  return picker.find('input[role="combobox"]')
}

beforeEach(() => {
  send.mockReset()
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('ProjectPicker combobox pattern', () => {
  it('exposes a combobox that starts closed and shows the chosen project', () => {
    const picker = mounted()
    expect(input(picker).attributes('aria-expanded')).toBe('false')
    expect(input(picker).attributes('aria-controls')).toBe('picker-list')
    expect((input(picker).element as HTMLInputElement).value).toBe('Skera')
  })

  it('opens with the arrow, moves with the arrows and points at the active option', async () => {
    const picker = mounted()
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    expect(input(picker).attributes('aria-expanded')).toBe('true')
    expect(input(picker).attributes('aria-activedescendant')).toBe('picker-option-project-1')
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    expect(input(picker).attributes('aria-activedescendant')).toBe('picker-option-project-2')
    await input(picker).trigger('keydown', { key: 'ArrowUp' })
    await input(picker).trigger('keydown', { key: 'ArrowUp' })
    expect(input(picker).attributes('aria-activedescendant')).toBe('picker-option-project-3')
    expect(picker.findAll('[role="option"]')).toHaveLength(3)
    expect(picker.find('#picker-option-project-1').attributes('aria-selected')).toBe('true')
  })

  it('picks the active option with Enter and closes', async () => {
    const picker = mounted()
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    await input(picker).trigger('keydown', { key: 'Enter' })
    expect(picker.emitted('update:modelValue')).toEqual([[2]])
    expect(input(picker).attributes('aria-expanded')).toBe('false')
  })

  it('lets Enter through to the form while the list is closed', async () => {
    const picker = mounted()
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input(picker).element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('closes only the list on Escape and keeps the event from reaching the dialog', async () => {
    const picker = mounted()
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    const seen = vi.fn()
    document.addEventListener('keydown', seen)
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input(picker).element.dispatchEvent(event)
    document.removeEventListener('keydown', seen)
    await nextTick()
    expect(input(picker).attributes('aria-expanded')).toBe('false')
    expect(event.defaultPrevented).toBe(true)
    expect(seen).not.toHaveBeenCalled()
  })

  it('filters while typing, ignoring case and accents', async () => {
    const picker = mounted()
    await input(picker).setValue('CLOUD')
    expect(picker.findAll('[role="option"]').map((option) => option.text())).toEqual([
      'Cloudmail',
      'Create the project « CLOUD »',
    ])
    expect(input(picker).attributes('aria-activedescendant')).toBe('picker-option-project-3')
  })

  it('says so when nothing matches and creation is the only way out', async () => {
    const picker = mounted()
    await input(picker).setValue('zzz')
    const options = picker.findAll('[role="option"]')
    expect(options).toHaveLength(1)
    expect(options[0]?.text()).toBe('Create the project « zzz »')
  })

  it('offers the all option first when asked and picks it as null', async () => {
    const picker = mounted({ modelValue: null, allLabel: 'All projects' })
    expect((input(picker).element as HTMLInputElement).value).toBe('All projects')
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    expect(picker.findAll('[role="option"]')[0]?.text()).toContain('All projects')
    await input(picker).trigger('keydown', { key: 'Enter' })
    expect(picker.emitted('update:modelValue')).toEqual([[null]])
  })
})

describe('ProjectPicker creation', () => {
  async function openCreation(picker: VueWrapper): Promise<void> {
    await input(picker).setValue('Cloud Nine')
    await input(picker).trigger('keydown', { key: 'ArrowDown' })
    await input(picker).trigger('keydown', { key: 'Enter' })
    await flushPromises()
  }

  it('opens the small form with the typed name as the last option', async () => {
    const picker = mounted()
    await openCreation(picker)
    const name = document.body.querySelector<HTMLInputElement>('[data-test-id="new-project-name"]')
    expect(name?.value).toBe('Cloud Nine')
  })

  it('creates the project, selects it and tells the parent', async () => {
    const created = project(9, 'Cloud Nine')
    send.mockResolvedValue(created)
    const picker = mounted()
    await openCreation(picker)
    const repository = document.body.querySelector<HTMLInputElement>('[data-test-id="new-project-repository"]')!
    repository.value = 'git@example.com:nine.git'
    repository.dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLButtonElement>('[data-test-id="new-project-create"]')!.click()
    await flushPromises()
    expect(send).toHaveBeenCalledWith('/api/projects', 'POST', {
      name: 'Cloud Nine',
      colour: expect.stringMatching(/^#[0-9a-f]{6}$/),
      repository: 'git@example.com:nine.git',
    })
    expect(picker.emitted('created')).toEqual([[created]])
    expect(picker.emitted('update:modelValue')).toEqual([[9]])
    expect(document.body.querySelector('[data-test-id="new-project-dialog"]')).toBeNull()
  })

  it('shows a blank name in the form and keeps the dialog open', async () => {
    const picker = mounted()
    await openCreation(picker)
    const name = document.body.querySelector<HTMLInputElement>('[data-test-id="new-project-name"]')!
    name.value = '   '
    name.dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLButtonElement>('[data-test-id="new-project-create"]')!.click()
    await flushPromises()
    expect(send).not.toHaveBeenCalled()
    expect(document.body.querySelector('[data-test-id="new-project-name-error"]')?.textContent).toContain('name')
    expect(name.getAttribute('aria-invalid')).toBe('true')
  })

  it('explains a name that is already taken without losing the typed values', async () => {
    const { BoardRequestError } = await import('@/technical/Api/BoardClient')
    send.mockRejectedValue(new BoardRequestError(409, 'ProjectSlugTakenError', 'taken'))
    const picker = mounted()
    await openCreation(picker)
    const repository = document.body.querySelector<HTMLInputElement>('[data-test-id="new-project-repository"]')!
    repository.value = 'git@example.com:nine.git'
    repository.dispatchEvent(new Event('input'))
    document.body.querySelector<HTMLButtonElement>('[data-test-id="new-project-create"]')!.click()
    await flushPromises()
    expect(document.body.querySelector('[data-test-id="new-project-name-error"]')?.textContent).toContain('already')
    expect(repository.value).toBe('git@example.com:nine.git')
    expect(document.body.querySelector<HTMLInputElement>('[data-test-id="new-project-name"]')!.value).toBe('Cloud Nine')
  })
})
