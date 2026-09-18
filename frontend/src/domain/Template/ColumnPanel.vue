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

const agent = ref('')
const prompt = ref('')
const delayHours = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

watch(
  column,
  (found) => {
    agent.value = found?.agent ?? ''
    prompt.value = found?.prompt ?? ''
    delayHours.value = found?.delayHours === null || found?.delayHours === undefined ? '' : String(found.delayHours)
  },
  { immediate: true },
)

async function write(): Promise<void> {
  const template = props.template
  if (template === null) {
    return
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send('/api/templates', 'POST', {
      slug: template.slug,
      name: template.name,
      isDefault: template.isDefault,
      columns: template.columns.map((one) =>
        one.state === props.stage
          ? {
              ...one,
              agent: agent.value.trim() === '' ? null : agent.value.trim(),
              prompt: prompt.value.trim() === '' ? null : prompt.value.trim(),
              delayHours: delayHours.value.trim() === '' ? null : Number(delayHours.value),
            }
          : one,
      ),
    })
    emit('written')
    emit('close')
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 border-b border-line bg-elev px-4 py-3">
    <div class="flex items-center gap-2">
      <p class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">
        {{ t('template.whoWorksIt') }}
      </p>
      <button
        type="button"
        class="ml-auto font-mono text-[10px] text-txt-low uppercase hover:text-txt-hi"
        @click="emit('close')"
      >
        {{ t('common.close') }}
      </button>
    </div>

    <p class="font-mono text-[10px] text-txt-low">
      {{ t('template.stayedOn', { name: template?.name ?? '', version: template?.version ?? 0 }) }}
    </p>

    <template v-if="maySettle">
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
        class="self-start rounded-lg border border-acc bg-acc px-3 py-1.5 font-mono text-[10px] font-bold text-ink uppercase disabled:opacity-40"
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
