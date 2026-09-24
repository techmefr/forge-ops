<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type { ColumnTemplate, TemplateColumn } from '@/domain/Board/BoardModel'

const props = defineProps<{ template: ColumnTemplate | null; stage: string; maySettle: boolean }>()
const emit = defineEmits<{ close: []; written: [] }>()

const { t } = useI18n()
const say = usePhrase()

const column = computed<TemplateColumn | null>(
  () => props.template?.columns.find((one) => one.state === props.stage) ?? null,
)

const COLUMN_COLOURS = ['acc', 'info', 'violet', 'green', 'orange', 'warn', 'red', 'line'] as const

const label = ref('')
const colour = ref('acc')
const agent = ref('')
const prompt = ref('')
const delayHours = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

const columnIndex = computed(
  () => props.template?.columns.findIndex((one) => one.state === props.stage) ?? -1,
)
const mayMoveUp = computed(() => columnIndex.value > 0)
const mayMoveDown = computed(() => {
  const total = props.template?.columns.length ?? 0
  return columnIndex.value !== -1 && columnIndex.value < total - 1
})

watch(
  column,
  (found) => {
    label.value = found?.label ?? ''
    colour.value = found?.colour ?? 'acc'
    agent.value = found?.agent ?? ''
    prompt.value = found?.prompt ?? ''
    delayHours.value = found?.delayHours === null || found?.delayHours === undefined ? '' : String(found.delayHours)
  },
  { immediate: true },
)

function writtenColumns(): TemplateColumn[] {
  const template = props.template
  if (template === null) {
    return []
  }
  return template.columns.map((one) =>
    one.state === props.stage
      ? {
          ...one,
          label: label.value.trim() === '' ? one.label : label.value.trim(),
          colour: colour.value,
          agent: agent.value.trim() === '' ? null : agent.value.trim(),
          prompt: prompt.value.trim() === '' ? null : prompt.value.trim(),
          delayHours: delayHours.value.trim() === '' ? null : Number(delayHours.value),
        }
      : one,
  )
}

async function send(columns: readonly TemplateColumn[]): Promise<boolean> {
  const template = props.template
  if (template === null) {
    return false
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send('/api/templates', 'POST', {
      slug: template.slug,
      name: template.name,
      isDefault: template.isDefault,
      columns,
    })
    emit('written')
    return true
  } catch (error) {
    refusal.value = reasonOf(error)
    return false
  } finally {
    busy.value = false
  }
}

async function write(): Promise<void> {
  if (await send(writtenColumns())) {
    emit('close')
  }
}

async function move(offset: number): Promise<void> {
  const template = props.template
  const index = columnIndex.value
  const swapIndex = index + offset
  if (template === null || index === -1 || swapIndex < 0 || swapIndex >= template.columns.length) {
    return
  }
  const current = template.columns[index]
  const swapped = template.columns[swapIndex]
  if (current === undefined || swapped === undefined) {
    return
  }
  const reordered = template.columns.map((one, position) => {
    if (position === index) {
      return swapped
    }
    if (position === swapIndex) {
      return current
    }
    return one
  })
  await send(reordered)
}
</script>

<template>
  <div class="flex flex-col gap-2 border-b border-line bg-elev px-4 py-3">
    <div class="flex items-center gap-2">
      <p class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
        {{ t('template.whoWorksIt') }}
      </p>
      <template v-if="maySettle">
        <button
          type="button"
          :disabled="busy || !mayMoveUp"
          :aria-label="t('template.moveUp')"
          class="ml-auto rounded-md border border-line px-2 py-1 font-mono text-[11px] text-txt-low hover:border-acc hover:text-txt-hi disabled:opacity-40"
          @click="move(-1)"
        >
          ◀
        </button>
        <button
          type="button"
          :disabled="busy || !mayMoveDown"
          :aria-label="t('template.moveDown')"
          class="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-txt-low hover:border-acc hover:text-txt-hi disabled:opacity-40"
          @click="move(1)"
        >
          ▶
        </button>
      </template>
      <button
        type="button"
        class="font-mono text-[11px] text-txt-low uppercase hover:text-txt-hi"
        :class="maySettle ? '' : 'ml-auto'"
        @click="emit('close')"
      >
        {{ t('common.close') }}
      </button>
    </div>

    <p class="font-mono text-[11px] text-txt-low">
      {{ t('template.stayedOn', { name: template?.name ?? '', version: template?.version ?? 0 }) }}
    </p>

    <template v-if="maySettle">
      <label class="flex flex-col gap-1 text-[11px] text-txt-mid">
        {{ t('template.label') }}
        <input
          v-model="label"
          type="text"
          class="rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[11px] text-txt-hi"
        />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-txt-mid">
        {{ t('template.colour') }}
        <select
          v-model="colour"
          class="w-40 rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[11px] text-txt-hi"
        >
          <option v-for="tone in COLUMN_COLOURS" :key="tone" :value="tone">{{ tone }}</option>
        </select>
        <span
          class="mt-1 inline-block h-2 w-8 rounded-full"
          :style="{ background: `var(--forge-${colour})` }"
          aria-hidden="true"
        />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-txt-mid">
        {{ t('template.agent') }}
        <input
          v-model="agent"
          type="text"
          class="rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[11px] text-txt-hi"
        />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-txt-mid">
        {{ t('template.prompt') }}
        <textarea
          v-model="prompt"
          rows="3"
          class="rounded-lg border border-line bg-card px-2 py-1.5 text-[11px] text-txt-hi"
        />
      </label>
      <label class="flex flex-col gap-1 text-[11px] text-txt-mid">
        {{ t('template.delayHours') }}
        <input
          v-model="delayHours"
          type="number"
          min="0"
          class="w-24 rounded-lg border border-line bg-card px-2 py-1.5 font-mono text-[11px] text-txt-hi"
        />
      </label>
      <button
        type="button"
        :disabled="busy"
        class="self-start rounded-lg border border-acc bg-acc px-3 py-1.5 font-mono text-[11px] font-bold text-ink uppercase disabled:opacity-40"
        @click="write()"
      >
        {{ t('template.writeVersion') }}
      </button>
      <p v-if="refusal !== null" class="text-[11px] text-red" role="alert">{{ say(refusal) }}</p>
    </template>

    <template v-else>
      <p class="text-[11px] text-txt-mid">
        {{ t('template.agent') }} ·
        <span class="font-mono">{{ column?.agent ?? t('template.noAgent') }}</span>
      </p>
      <p class="text-[11px] text-txt-mid">
        {{ t('template.delayHours') }} ·
        <span class="font-mono">{{ column?.delayHours ?? t('common.nothing') }}</span>
      </p>
      <p v-if="column?.prompt" class="text-[11px] text-txt-low">{{ column.prompt }}</p>
      <p class="text-[11px] text-txt-low">{{ t('template.adminOnly') }}</p>
    </template>
  </div>
</template>
