import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createBoardI18n } from '@/technical/Language/I18n'
import FileBrowser from '@/domain/File/FileBrowser.vue'
import type { FileReading, TreeReading } from '@/domain/File/FileTree'

const read = vi.fn()

vi.mock('@/technical/Api/Board', () => ({
  board: {
    read: (...args: unknown[]) => read(...(args as [string])),
    send: vi.fn(),
  },
}))

const treeReading: TreeReading = {
  available: true,
  reason: null,
  entries: [
    {
      path: 'src/App.vue',
      name: 'App.vue',
      kind: 'file',
      bytes: 10,
      description: '',
      mark: 'quiet',
      byReferences: [],
      agentName: null,
    },
  ],
}

const noClashes = { available: true, reason: null, clashes: [] }

function fileReading(overrides: Partial<FileReading> = {}): FileReading {
  return {
    path: 'src/App.vue',
    text: '<template />',
    bytes: 10,
    truncated: false,
    description: '',
    mark: 'quiet',
    byReferences: [],
    agentName: null,
    highlightedHtml: '<pre><code><span class="couleur">colore-par-le-serveur</span></code></pre>',
    highlightAvailable: true,
    ...overrides,
  }
}

function mounted() {
  return mount(FileBrowser, {
    props: { projectId: 1 },
    global: {
      plugins: [createBoardI18n('fr')],
      stubs: { CardHead: { template: '<div><slot /></div>' }, Glyph: true },
    },
  })
}

async function openTheOnlyFile(wrapper: ReturnType<typeof mounted>): Promise<void> {
  await flushPromises()
  await wrapper.find('button').trigger('click')
  await flushPromises()
}

describe('FileBrowser affiche le rendu deja colore par le serveur', () => {
  it("n'utilise plus de coloration cote client, juste le html recu", async () => {
    read.mockImplementation(async (url: string) => {
      if (url.includes('/tree')) return treeReading
      if (url.includes('/clashes')) return noClashes
      if (url.includes('/file?')) return fileReading()
      throw new Error(`route inattendue: ${url}`)
    })

    const wrapper = mounted()
    await openTheOnlyFile(wrapper)

    expect(wrapper.html()).toContain('colore-par-le-serveur')
    expect(wrapper.find('code').html()).toContain('class="couleur"')
  })

  it("signale par i18n quand le serveur n'a pas su colorer le fichier", async () => {
    read.mockImplementation(async (url: string) => {
      if (url.includes('/tree')) return treeReading
      if (url.includes('/clashes')) return noClashes
      if (url.includes('/file?')) return fileReading({ highlightAvailable: false })
      throw new Error(`route inattendue: ${url}`)
    })

    const wrapper = mounted()
    await openTheOnlyFile(wrapper)

    expect(wrapper.text()).toContain('Pas de coloration pour ce type de fichier.')
  })

  it('ne montre pas le message quand le serveur a bien colore le fichier', async () => {
    read.mockImplementation(async (url: string) => {
      if (url.includes('/tree')) return treeReading
      if (url.includes('/clashes')) return noClashes
      if (url.includes('/file?')) return fileReading({ highlightAvailable: true })
      throw new Error(`route inattendue: ${url}`)
    })

    const wrapper = mounted()
    await openTheOnlyFile(wrapper)

    expect(wrapper.text()).not.toContain('Pas de coloration pour ce type de fichier.')
  })
})
