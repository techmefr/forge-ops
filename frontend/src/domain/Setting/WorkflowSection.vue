<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EffectBadge from './EffectBadge.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type { WorkflowPhaseEntry } from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const settings = useResource<{ phases: readonly WorkflowPhaseEntry[]; maySettle: boolean }>(() =>
  board.read('/api/settings/workflow'),
)
const draft = ref<WorkflowPhaseEntry[]>([])
const refusal = ref<Phrase | null>(null)
const saved = ref(false)
const busy = ref(false)

async function save(): Promise<void> {
  busy.value = true
  refusal.value = null
  saved.value = false
  try {
    await board.send('/api/settings/workflow', 'PUT', draft.value)
    saved.value = true
    await settings.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

watch(
  () => settings.data.value,
  (value) => {
    if (value !== null) {
      draft.value = value.phases.map((entry) => ({ ...entry }))
    }
  },
)

onMounted(() => settings.reload())
</script>

<template>
  <section class="flex flex-col gap-4 rounded-lg border border-line bg-card p-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-[22px]">{{ t('setting.workflow') }}</h2>
      <EffectBadge section="workflow" />
    </div>

    <p class="text-[13px] text-txt-low">{{ t('workflow.whatItControls') }}</p>

    <form class="flex flex-col gap-4" @submit.prevent="save">
      <fieldset
        v-for="entry in draft"
        :key="entry.phase"
        class="flex flex-col gap-2 rounded-lg border border-line bg-panel p-3"
      >
        <legend class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
          {{ t(`phase.${entry.phase}`) }}
        </legend>

        <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
          {{ t('workflow.agentName') }}
          <input
            v-model="entry.agentName"
            type="text"
            :aria-label="`${t('workflow.agentName')} - ${t(`phase.${entry.phase}`)}`"
            class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
          />
        </label>

        <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
          {{ t('workflow.command') }}
          <input
            v-model="entry.command"
            type="text"
            :aria-label="`${t('workflow.command')} - ${t(`phase.${entry.phase}`)}`"
            class="rounded-lg border border-line bg-card px-3 py-2 font-mono text-[13px] text-txt-hi"
          />
        </label>

        <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
          {{ t('workflow.preprompt') }}
          <textarea
            v-model="entry.preprompt"
            rows="3"
            :aria-label="`${t('workflow.preprompt')} - ${t(`phase.${entry.phase}`)}`"
            class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
          />
        </label>
      </fieldset>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="busy || !(settings.data.value?.maySettle ?? false)"
          class="rounded-lg border border-acc bg-acc px-4 py-2 text-[13px] font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ t('common.save') }}
        </button>
        <span v-if="saved" class="text-[13px] text-green">{{ t('workflow.saved') }}</span>
      </div>

      <p v-if="refusal !== null" class="text-[13px] text-red" role="alert">{{ say(refusal) }}</p>
    </form>
  </section>
</template>
