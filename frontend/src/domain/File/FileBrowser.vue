<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import { createLatest } from '@/technical/Api/Latest'
import Glyph from '@/technical/Ui/Glyph.vue'
import { decoratedOf } from '@/technical/Ui/CodeDecor'
import CardHead from './CardHead.vue'
import { crumbsOf, toneOf } from './FileMarkTone'
import { saidOf, type FileVerdictView } from './FileSaid'
import type { ClashReading, FileReading, TreeEntry, TreeReading } from './FileTree'

const { projectId } = defineProps<{ projectId: number | null }>()

const { t, locale } = useI18n()
const say = usePhrase()

function spoken(verdict: FileVerdictView): string {
  return saidOf(verdict, locale.value, (key, values, count) => t(key, values, count))
}

const here = ref('')
const tree = ref<TreeReading | null>(null)
const opened = ref<FileReading | null>(null)
const clashes = ref<ClashReading | null>(null)
const checkoutPath = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

const treeShown = ref(true)
const codeShown = ref(true)
const wide = ref<'split' | 'tree' | 'code'>('split')

const crumbs = computed(() => crumbsOf(here.value))
const painted = computed(() =>
  opened.value === null ? '' : decoratedOf(opened.value.highlightedHtml),
)

const walking = createLatest()
const counting = createLatest()

async function look(): Promise<void> {
  if (projectId === null) {
    tree.value = null
    return
  }
  const ticket = walking.claim()
  busy.value = true
  refusal.value = null
  try {
    const read = await board.read<TreeReading>(
      `/api/projects/${projectId}/tree?path=${encodeURIComponent(here.value)}`,
    )
    if (walking.isCurrent(ticket)) {
      tree.value = read
    }
  } catch (error) {
    if (walking.isCurrent(ticket)) {
      tree.value = null
      refusal.value = reasonOf(error)
    }
  } finally {
    busy.value = false
  }
}

async function lookForClashes(): Promise<void> {
  if (projectId === null) {
    clashes.value = null
    return
  }
  const ticket = counting.claim()
  try {
    const read = await board.read<ClashReading>(`/api/projects/${projectId}/clashes`)
    if (counting.isCurrent(ticket)) {
      clashes.value = read
    }
  } catch {
    if (counting.isCurrent(ticket)) {
      clashes.value = null
    }
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
    codeShown.value = true
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

function widen(card: 'tree' | 'code'): void {
  wide.value = wide.value === card ? 'split' : card
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
  <div class="flex h-full min-h-0 flex-col gap-4">
    <form
      v-if="tree !== null && !tree.available && tree.reason === 'CheckoutUnknown'"
      class="rounded-lg border border-line bg-card p-4"
      @submit.prevent="pointCheckout"
    >
      <p class="title-face text-sm text-txt-mid">{{ t('browser.noCheckout') }}</p>
      <p class="mt-1 text-sm text-txt-low">{{ t('browser.noCheckoutHint') }}</p>
      <div class="mt-3 flex flex-wrap gap-2">
        <input
          v-model="checkoutPath"
          type="text"
          :placeholder="t('browser.checkoutPlaceholder')"
          :aria-label="t('browser.pointFolder')"
          class="min-w-[280px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 font-mono text-sm text-txt-hi"
        />
        <button
          type="submit"
          :disabled="busy || checkoutPath === ''"
          class="rounded-lg bg-acc px-3 py-2 text-xs font-bold text-ink disabled:opacity-40"
        >
          {{ t('browser.pointFolder') }}
        </button>
      </div>
    </form>

    <section
      v-if="clashes !== null && clashes.clashes.length > 0"
      class="rounded-lg border border-orange bg-card p-4"
    >
      <p class="text-xs text-orange">
        {{ t('browser.closeNames') }}
      </p>
      <p class="mt-1 text-sm text-txt-low">{{ t('browser.closeNamesHint') }}</p>
      <div
        tabindex="0"
        role="region"
        :aria-label="t('browser.closeNames')"
        class="mt-2 flex max-h-[16vh] flex-col gap-1.5 overflow-y-auto"
      >
        <p v-for="clash in clashes.clashes" :key="clash.name" class="text-sm text-txt-hi">
          <span class="font-mono text-xs text-orange">{{ clash.name }}</span>
          <span class="ml-2 font-mono text-xs text-txt-low">{{ clash.paths.join('  ·  ') }}</span>
        </p>
      </div>
    </section>

    <p v-if="refusal !== null" class="text-sm text-red" role="alert">{{ say(refusal) }}</p>

    <div
      class="grid min-h-[240px] flex-1 gap-4"
      :class="wide === 'split' ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]' : 'lg:grid-cols-1'"
    >
      <section
        v-if="wide !== 'code'"
        class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-card"
        :class="treeShown ? '' : 'self-start'"
      >
        <CardHead
          :shown="treeShown"
          :wide="wide === 'tree'"
          @toggle-shown="treeShown = !treeShown"
          @toggle-wide="widen('tree')"
        >
          <nav class="flex flex-wrap items-center gap-1" :aria-label="t('browser.pathNav')">
            <template v-for="(crumb, depth) in crumbs" :key="crumb.path">
              <span v-if="depth > 0" class="font-mono text-xs text-txt-low" aria-hidden="true">/</span>
              <button
                type="button"
                class="min-h-[24px] max-sm:min-h-10 max-sm:min-w-10 rounded px-1 text-xs"
                :class="depth === crumbs.length - 1 ? 'text-txt-hi' : 'text-txt-low hover:text-acc'"
                @click="here = crumb.path"
              >
                {{ crumb.root ? t('browser.root') : crumb.label }}
              </button>
            </template>
          </nav>
        </CardHead>

        <template v-if="treeShown">
          <p v-if="tree === null || !tree.available" class="p-4 text-sm text-txt-low">
            {{
              tree?.reason === 'CheckoutUnknown'
                ? t('browser.noCheckoutDeclared')
                : t('browser.nothingToRead')
            }}
          </p>

          <ul v-else class="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <li v-for="entry in tree.entries" :key="entry.path">
              <button
                type="button"
                class="flex min-h-[36px] w-full items-center gap-2.5 border-b border-line/60 px-4 py-2 text-left hover:bg-elev"
                :class="opened?.path === entry.path ? 'bg-elev' : ''"
                @click="enter(entry)"
              >
                <Glyph
                  :name="entry.kind === 'directory' ? 'folder' : 'file'"
                  :size="14"
                  :class="entry.kind === 'directory' ? 'text-txt-hi' : 'text-txt-low'"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex items-center gap-2">
                    <span class="truncate font-mono text-sm" :class="toneOf(entry.mark).text">{{
                      entry.name
                    }}</span>
                    <span
                      v-if="entry.mark !== 'quiet'"
                      class="h-1.5 w-1.5 flex-none rounded-full"
                      :class="toneOf(entry.mark).dot"
                      aria-hidden="true"
                    />
                    <span
                      v-if="spoken(entry) !== ''"
                      class="truncate text-xs"
                      :class="toneOf(entry.mark).text"
                      >{{ spoken(entry) }}</span
                    >
                  </span>
                  <span v-if="entry.description !== null" class="block truncate text-xs text-txt-low">{{
                    t(`fileDescription.${entry.description.key}`, entry.description.values)
                  }}</span>
                </span>
              </button>
            </li>
          </ul>
        </template>
      </section>

      <section
        v-if="wide !== 'tree'"
        class="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-line bg-card"
        :class="codeShown ? '' : 'self-start'"
      >
        <CardHead
          :shown="codeShown"
          :wide="wide === 'code'"
          @toggle-shown="codeShown = !codeShown"
          @toggle-wide="widen('code')"
        >
          <p class="truncate font-mono text-xs text-txt-hi">
            {{ opened === null ? t('browser.noFileOpen') : opened.path }}
          </p>
          <p v-if="opened !== null && opened.description !== null" class="truncate text-xs text-txt-low">
            {{ t(`fileDescription.${opened.description.key}`, opened.description.values) }}
          </p>
        </CardHead>

        <template v-if="codeShown">
          <p v-if="opened === null" class="p-4 text-sm text-txt-low">{{ t('browser.clickFile') }}</p>

          <template v-else>
            <p
              v-if="spoken(opened) !== ''"
              class="border-b border-line px-4 py-2 text-xs"
              :class="toneOf(opened.mark).text"
            >
              {{ spoken(opened) }}
            </p>
            <p v-if="!opened.highlightAvailable" class="border-b border-line px-4 py-2 text-xs text-txt-low">
              {{ t('browser.noHighlight') }}
            </p>
            <pre
              tabindex="0"
              role="region"
              :aria-label="t('browser.fileContent')"
              class="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-txt-mid"
            ><code v-html="painted" /></pre>
            <p v-if="opened.truncated" class="border-t border-line px-4 py-2 text-xs text-txt-low">
              {{ t('browser.truncated', { bytes: opened.bytes }) }}
            </p>
          </template>
        </template>
      </section>
    </div>
  </div>
</template>
