<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DECISION_TEXT_LIMIT, PERSON_LIMIT, type ProjectDecision } from '@contract/FollowUpContract'
import { dayLabel } from './DayLabel'

export type DecisionDraft = {
  text: string
  decidedBy?: string
}

const props = defineProps<{
  projectId: number
  decisions: readonly ProjectDecision[]
  busy: boolean
  add: (draft: DecisionDraft) => Promise<boolean>
}>()

const { t, locale } = useI18n()

const decisionText = ref('')
const decisionBy = ref('')

async function addDecision(): Promise<void> {
  const done = await props.add({
    text: decisionText.value,
    ...(decisionBy.value.trim() === '' ? {} : { decidedBy: decisionBy.value }),
  })
  if (done) {
    decisionText.value = ''
    decisionBy.value = ''
  }
}
</script>

<template>
  <section class="flex flex-col gap-2" :aria-labelledby="`fu-decisions-${projectId}`">
    <h3 :id="`fu-decisions-${projectId}`" class="text-xs text-txt-low">
      {{ t('followUp.drawer.decisionsSection') }}
    </h3>
    <p v-if="decisions.length === 0" class="text-sm text-txt-low">{{ t('followUp.drawer.noDecisions') }}</p>
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="decision in decisions"
        :key="decision.id"
        class="flex items-start gap-2 rounded-lg bg-card p-2.5"
      >
        <span class="flex-none tabular-nums text-xs text-txt-mid">
          {{ dayLabel(decision.decidedOn, locale, true) }}
        </span>
        <div class="min-w-0 flex-1">
          <b class="text-sm text-txt-hi">{{ decision.text }}</b>
          <small class="block text-xs text-txt-mid">{{ decision.decidedBy }}</small>
        </div>
      </li>
    </ul>
    <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="addDecision">
      <label class="flex flex-col gap-1 text-sm text-txt-mid sm:col-span-2">
        {{ t('followUp.drawer.decisionText') }}
        <input
          v-model="decisionText"
          type="text"
          required
          :maxlength="DECISION_TEXT_LIMIT"
          class="field"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-txt-mid">
        {{ t('followUp.drawer.decisionBy') }}
        <input
          v-model="decisionBy"
          type="text"
          :maxlength="PERSON_LIMIT"
          class="field"
        />
      </label>
      <button
        type="submit"
        :disabled="busy || decisionText.trim() === ''"
        class="btn btn-primary btn-sm w-fit self-end"
      >
        {{ t('followUp.drawer.addDecision') }}
      </button>
    </form>
  </section>
</template>
