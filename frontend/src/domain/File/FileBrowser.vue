<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import Glyph from '@/technical/Ui/Glyph.vue'
import { MARK_TONES, crumbsOf, toneOf } from './FileMarkTone'
import type { ClashReading, FileReading, TreeEntry, TreeReading } from './FileTree'

const { projectId } = defineProps<{ projectId: number | null }>()

const here = ref('')
const tree = ref<TreeReading | null>(null)
const opened = ref<FileReading | null>(null)
const clashes = ref<ClashReading | null>(null)
const checkoutPath = ref('')
const refusal = ref<string | null>(null)
const busy = ref(false)

const crumbs = computed(() => crumbsOf(here.value))
const spoken = computed(() => Object.entries(MARK_TONES).filter(([, tone]) => tone.label !== ''))

async function look(): Promise<void> {
  if (projectId === null) {
    tree.value = null
    return
  }
  busy.value = true
  refusal.value = null
  try {
    tree.value = await board.read<TreeReading>(
      `/api/projects/${projectId}/tree?path=${encodeURIComponent(here.value)}`,
    )
  } catch (error) {
    tree.value = null
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

async function lookForClashes(): Promise<void> {
  if (projectId === null) {
    clashes.value = null
    return
  }
  try {
    clashes.value = await board.read<ClashReading>(`/api/projects/${projectId}/clashes`)
  } catch {
    clashes.value = null
  }
}

async function openFile(path: string): Promise<void> {
  if (projectId === null) {
    return
  }
  busy.value = true
  refusal.value = null
  try {
    opened.value = await board.read<FileReading>(
      `/api/projects/${projectId}/file?path=${encodeURIComponent(path)}`,
    )
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function enter(entry: TreeEntry): void {
  if (entry.kind === 'directory') {
    here.value = entry.path
    return
  }
  void openFile(entry.path)
}

function goTo(path: string): void {
  here.value = path
}

async function pointCheckout(): Promise<void> {
  if (projectId === null || checkoutPath.value === '') {
    return
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send(`/api/projects/${projectId}/checkout`, 'PUT', { checkoutPath: checkoutPath.value })
    checkoutPath.value = ''
    await Promise.all([look(), lookForClashes()])
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

watch(
  () => projectId,
  () => {
    here.value = ''
    opened.value = null
    void look()
    void lookForClashes()
  },
  { immediate: true },
)

watch(here, () => void look())
</script>

<template>
  <div class="flex min-h-0 flex-col gap-4">
    <form
      v-if="tree !== null && !tree.available && tree.reason === 'CheckoutUnknown'"
      class="rounded-2xl border border-line bg-card p-4"
      @submit.prevent="pointCheckout"
    >
      <p class="display-italic text-sm text-txt-mid">Ce projet n a pas encore de copie locale</p>
      <p class="mt-1 text-xs text-txt-low">
        Donne le dossier ou le depot est clone sur cette machine pour voir ses fichiers.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <input
          v-model="checkoutPath"
          type="text"
          placeholder="/home/gaetan/mailer"
          class="min-w-[280px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 font-mono text-xs text-txt-hi"
        />
        <button
          type="submit"
          :disabled="busy || checkoutPath === ''"
          class="rounded-lg bg-acc px-3 py-2 text-[10px] font-bold text-ink uppercase disabled:opacity-40"
        >
          Pointer le dossier
        </button>
      </div>
    </form>

    <section
      v-if="clashes !== null && clashes.clashes.length > 0"
      class="rounded-2xl border border-orange bg-card p-4"
    >
      <p class="font-mono text-[10px] tracking-[0.18em] text-orange uppercase">Noms trop proches</p>
      <p class="mt-1 text-xs text-txt-low">
        A dire a la session avant qu elle en cree un deuxieme.
      </p>
      <ul class="mt-2 flex flex-col gap-1.5">
        <li v-for="clash in clashes.clashes" :key="clash.name" class="text-xs text-txt-hi">
          <span class="font-mono text-[11px] text-orange">{{ clash.name }}</span>
          <span class="ml-2 font-mono text-[11px] text-txt-low">{{ clash.paths.join('  ·  ') }}</span>
        </li>
      </ul>
    </section>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ refusal }}</p>

    <div class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
      <section class="min-w-0 rounded-2xl border border-line bg-card">
        <nav class="flex flex-wrap items-center gap-1 border-b border-line px-4 py-2.5" aria-label="Chemin">
          <template v-for="(crumb, depth) in crumbs" :key="crumb.path">
            <span v-if="depth > 0" class="font-mono text-[10px] text-txt-low" aria-hidden="true">/</span>
            <button
              type="button"
              class="min-h-[24px] rounded px-1 font-mono text-[11px]"
              :class="depth === crumbs.length - 1 ? 'text-txt-hi' : 'text-txt-low hover:text-acc'"
              @click="goTo(crumb.path)"
            >
              {{ crumb.label }}
            </button>
          </template>
        </nav>

        <p v-if="tree === null || !tree.available" class="p-4 text-sm text-txt-low">
          {{ tree?.reason === 'CheckoutUnknown' ? 'Aucune copie locale declaree.' : 'Rien a lire ici.' }}
        </p>

        <ul v-else class="flex flex-col">
          <li v-for="entry in tree.entries" :key="entry.path">
            <button
              type="button"
              class="flex w-full min-h-[36px] items-center gap-2.5 border-b border-line/60 px-4 py-2 text-left hover:bg-elev"
              :class="opened?.path === entry.path ? 'bg-elev' : ''"
              @click="enter(entry)"
            >
              <Glyph
                :name="entry.kind === 'directory' ? 'folder' : 'file'"
                :size="14"
                :class="entry.kind === 'directory' ? 'text-acc' : 'text-txt-low'"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="truncate font-mono text-[12px]" :class="toneOf(entry.mark).text">{{
                    entry.name
                  }}</span>
                  <span
                    v-if="toneOf(entry.mark).label !== ''"
                    class="h-1.5 w-1.5 flex-none rounded-full"
                    :class="toneOf(entry.mark).dot"
                    aria-hidden="true"
                  />
                  <span v-if="entry.said !== ''" class="truncate text-[10px]" :class="toneOf(entry.mark).text">{{
                    entry.said
                  }}</span>
                </span>
                <span v-if="entry.description !== ''" class="block truncate text-[11px] text-txt-low">{{
                  entry.description
                }}</span>
              </span>
            </button>
          </li>
        </ul>
      </section>

      <section class="min-w-0 rounded-2xl border border-line bg-card">
        <div v-if="opened === null" class="p-4">
          <p class="text-sm text-txt-low">Clique un fichier pour l ouvrir.</p>
          <ul class="mt-4 flex flex-col gap-1.5">
            <li v-for="[mark, tone] in spoken" :key="mark" class="flex items-center gap-2 text-[11px]">
              <span class="h-2 w-2 flex-none rounded-full" :class="tone.dot" aria-hidden="true" />
              <span :class="tone.text">{{ tone.label }}</span>
            </li>
          </ul>
        </div>

        <template v-else>
          <div class="border-b border-line px-4 py-3">
            <p class="font-mono text-[11px] break-all text-txt-hi">{{ opened.path }}</p>
            <p v-if="opened.description !== ''" class="mt-0.5 text-[11px] text-txt-low">
              {{ opened.description }}
            </p>
            <p v-if="opened.said !== ''" class="mt-1 text-[11px]" :class="toneOf(opened.mark).text">
              {{ opened.said }}
            </p>
          </div>
          <pre
            class="max-h-[520px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-txt-mid"
            >{{ opened.text }}</pre
          >
          <p v-if="opened.truncated" class="border-t border-line px-4 py-2 text-[10px] text-txt-low">
            Fichier coupe, {{ opened.bytes }} octets au total.
          </p>
        </template>
      </section>
    </div>
  </div>
</template>
