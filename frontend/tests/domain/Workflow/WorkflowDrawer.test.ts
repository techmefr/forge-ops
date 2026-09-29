import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { ProjectWorkflow, WorkflowColumn } from '@contract/WorkflowColumnContract'
import { PROMPT_TEMPLATES } from '@contract/WorkflowColumnContract'
import { createBoardI18n } from '@/technical/Language/I18n'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import WorkflowDrawer from '@/domain/Workflow/WorkflowDrawer.vue'
import WorkflowEmptyState from '@/domain/Workflow/WorkflowEmptyState.vue'

const read = vi.fn()
const send = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: (...args: unknown[]) => send(...(args as [string, string, unknown])),
  },
}))

function column(id: number, key: string, label: string, overrides: Partial<WorkflowColumn> = {}): WorkflowColumn {
  return {
    id,
    projectId: 3,
    key,
    label,
    colour: '#7C3AED',
    position: id,
    provider: 'claude',
    model: 'claude-opus-5-5',
    effort: 'high',
    agentName: '',
    command: '/speckit.specify',
    preprompt: 'Read the epic.',
    autoStart: true,
    behaviouralKind: 'ordinary',
    ...overrides,
  }
}

const ADMIN = { login: 'ana', name: 'Ana' }

let workflow: ProjectWorkflow
let wrapper: VueWrapper | null = null

async function open(): Promise<void> {
  wrapper = mount(WorkflowDrawer, {
    props: { projectId: 3, projectName: 'Hopla' },
    global: { plugins: [createBoardI18n('en')] },
    attachTo: document.body,
  })
  await flushPromises()
}

function inBody(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector)
}

function buttonNamed(text: string): HTMLButtonElement | undefined {
  return [...document.body.querySelectorAll('button')].find((button) => (button.textContent ?? '').trim() === text)
}

beforeEach(() => {
  read.mockReset()
  send.mockReset()
  send.mockResolvedValue({})
  workflow = { columns: [], maySettle: true, admin: ADMIN }
  read.mockImplementation(() => Promise.resolve(workflow))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('a project without a workflow', () => {
  it('guides the admin to create it from the five templates', async () => {
    await open()

    expect(document.body.textContent).toContain('No workflow for Hopla yet.')
    buttonNamed('Create the workflow')?.click()
    await flushPromises()

    const created = send.mock.calls.filter(([path, method]) => path === '/api/projects/3/workflow-columns' && method === 'POST')
    expect(created.map(([, , body]) => (body as { label: string }).label)).toEqual(['Spec', 'Plan', 'Build', 'Review', 'Ship'])
    expect((created[0]?.[2] as { preprompt: string }).preprompt).toBe(PROMPT_TEMPLATES.spec)
  })

  it('shows the fixed first and last steps', async () => {
    await open()

    expect(document.body.textContent).toContain('Backlog · fixed, first step')
    expect(document.body.textContent).toContain('Done · fixed, last step')
  })
})

describe('the empty state for someone who is not the admin', () => {
  it('says who has to define the workflow and offers nothing to click', () => {
    const empty = mount(WorkflowEmptyState, {
      props: { projectName: 'Hopla', admin: ADMIN, maySettle: false },
      global: { plugins: [createBoardI18n('en')] },
    })

    expect(empty.text()).toContain('Ana, the project admin, has to define it.')
    expect(empty.find('button').exists()).toBe(false)
  })

  it('asks for an admin when the project has none', () => {
    const empty = mount(WorkflowEmptyState, {
      props: { projectName: 'Hopla', admin: null, maySettle: false },
      global: { plugins: [createBoardI18n('en')] },
    })

    expect(empty.text()).toContain('no admin yet')
  })
})

describe('the steps', () => {
  beforeEach(() => {
    workflow = {
      columns: [column(1, 'spec', 'Spec'), column(2, 'build', 'Build', { provider: 'codex', model: '', command: 'codex exec' })],
      maySettle: true,
      admin: ADMIN,
    }
  })

  it('offers the Claude models, then only the CLI default for Codex', async () => {
    await open()

    const cards = document.body.querySelectorAll('ol > li')
    const claudeModels = [...(cards[0]?.querySelectorAll('select')[1]?.querySelectorAll('option') ?? [])].map((option) => option.value)
    const codexModels = [...(cards[1]?.querySelectorAll('select')[1]?.querySelectorAll('option') ?? [])].map((option) => option.value)
    expect(claudeModels).toEqual(['claude-opus-5-5', 'claude-sonnet-5', 'claude-fable-5-1', 'claude-haiku-4-5'])
    expect(codexModels).toEqual([''])
  })

  it('hides model, effort and auto start on a human step', async () => {
    await open()
    const first = document.body.querySelector('ol > li') as HTMLElement
    const provider = first.querySelector('select') as HTMLSelectElement

    provider.value = 'human'
    provider.dispatchEvent(new Event('change'))
    await flushPromises()

    expect(first.querySelectorAll('select')).toHaveLength(1)
    expect(first.querySelector('input[type="checkbox"]')).toBeNull()
    expect(first.textContent).toContain('Validation step')
  })

  it('saves an edited step with the whole draft', async () => {
    await open()
    const first = document.body.querySelector('ol > li') as HTMLElement
    const effort = first.querySelectorAll('select')[2] as HTMLSelectElement

    effort.value = 'max'
    effort.dispatchEvent(new Event('change'))
    await flushPromises()
    ;(first.querySelector('button.bg-acc') as HTMLButtonElement).click()
    await flushPromises()

    expect(send).toHaveBeenCalledWith(
      '/api/projects/3/workflow-columns/1',
      'PUT',
      expect.objectContaining({ label: 'Spec', provider: 'claude', effort: 'max', autoStart: true }),
    )
  })

  it('fills the prompt with a template', async () => {
    await open()
    const first = document.body.querySelector('ol > li') as HTMLElement
    const template = first.querySelectorAll('select')[3] as HTMLSelectElement

    template.value = 'review'
    template.dispatchEvent(new Event('change'))
    await flushPromises()

    expect((first.querySelector('textarea') as HTMLTextAreaElement).value).toBe(PROMPT_TEMPLATES.review)
  })

  it('reorders with the keys in the new order', async () => {
    await open()

    ;(document.body.querySelector('button[aria-label="Move the step Spec down"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(send).toHaveBeenCalledWith('/api/projects/3/workflow-columns/order', 'PUT', { keysInOrder: ['build', 'spec'] })
  })

  it('cannot move the first step up nor the last one down', async () => {
    await open()

    expect((document.body.querySelector('button[aria-label="Move the step Spec up"]') as HTMLButtonElement).disabled).toBe(true)
    expect((document.body.querySelector('button[aria-label="Move the step Build down"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('says why a step holding stories stays', async () => {
    send.mockRejectedValue(new BoardRequestError(409, 'WorkflowColumnInUseError', 'x'))
    await open()

    ;(document.body.querySelector('button[aria-label="Delete the step Spec"]') as HTMLButtonElement).click()
    await flushPromises()

    expect(inBody('[role="alert"]')?.textContent).toContain('This step still holds stories')
  })

  it('adds a step by name', async () => {
    await open()
    const field = document.body.querySelector('form input') as HTMLInputElement

    field.value = 'Triage'
    field.dispatchEvent(new Event('input'))
    await flushPromises()
    buttonNamed('Add a step')?.click()
    await flushPromises()

    expect(send).toHaveBeenCalledWith(
      '/api/projects/3/workflow-columns',
      'POST',
      expect.objectContaining({ label: 'Triage', provider: 'claude' }),
    )
  })

  it('asks to close when Escape is pressed', async () => {
    await open()

    inBody('[data-test="workflow-drawer"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()

    expect(wrapper?.emitted('close')).toBeTruthy()
  })

  it('names the dialog and its steps for assistive technology', async () => {
    await open()

    expect(inBody('[role="dialog"]')?.getAttribute('aria-labelledby')).not.toBeNull()
    expect(inBody('ol')?.getAttribute('aria-label')).toBe('Steps of the workflow of Hopla')
  })
})
