<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EpicOverview } from '@/domain/Board/BoardModel'
import {
  PERSON_LIMIT,
  RISK_LEVELS,
  RISK_TEXT_LIMIT,
  type ProjectRisk,
  type RiskLevel,
} from '@contract/FollowUpContract'
import { dayLabel } from './DayLabel'

export type RiskDraft = {
  text: string
  level: RiskLevel
  owner: string | null
  epicId: number | null
}

const props = defineProps<{
  projectId: number
  risks: readonly ProjectRisk[]
  subjects: readonly EpicOverview[]
  busy: boolean
  add: (draft: RiskDraft) => Promise<boolean>
  toggle: (risk: ProjectRisk) => Promise<boolean>
}>()

const { t, locale } = useI18n()

const riskText = ref('')
const riskLevel = ref<RiskLevel>('medium')
const riskOwner = ref('')
const riskEpic = ref<number | null>(null)

const openCount = computed(() => props.risks.filter((risk) => risk.closedOn === null).length)

function subjectTitle(epicId: number | null): string | null {
  return props.subjects.find((subject) => subject.id === epicId)?.title ?? null
}

function riskMeta(risk: ProjectRisk): string {
  const date = dayLabel(risk.openedOn, locale.value, true)
  const base =
    risk.owner === null
      ? t('followUp.drawer.riskMetaNobody', { date })
      : t('followUp.drawer.riskMeta', { owner: risk.owner, date })
  const subject = subjectTitle(risk.epicId)
  return subject === null ? base : `${base} · ${subject}`
}

async function addRisk(): Promise<void> {
  const done = await props.add({
    text: riskText.value,
    level: riskLevel.value,
    owner: riskOwner.value.trim() === '' ? null : riskOwner.value,
    epicId: riskEpic.value,
  })
  if (done) {
    riskText.value = ''
    riskOwner.value = ''
    riskEpic.value = null
  }
}
</script>

<template>
  <section class="flex flex-col gap-2" :aria-labelledby="`fu-risks-${projectId}`">
    <h3 :id="`fu-risks-${projectId}`" class="text-xs text-txt-low">
      {{ t('followUp.drawer.risksSection', { count: openCount }) }}
    </h3>
    <p v-if="risks.length === 0" class="text-sm text-txt-low">{{ t('followUp.drawer.noRisks') }}</p>
    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="risk in risks"
        :key="risk.id"
        class="flex items-start gap-2 rounded-lg bg-card p-2.5"
        :class="{ 'opacity-70': risk.closedOn !== null }"
        :data-test-id="`risk-${risk.id}`"
      >
        <span class="flex-none rounded px-1.5 py-0.5 text-xs font-bold text-txt-hi">
          {{ t(`riskLevel.${risk.level}`) }}
        </span>
        <div class="min-w-0 flex-1">
          <b class="text-sm text-txt-hi">{{ risk.text }}</b>
          <small class="block text-xs text-txt-mid">
            {{ riskMeta(risk) }}
            <template v-if="risk.closedOn !== null">
              · {{ t('followUp.drawer.closedOn', { date: dayLabel(risk.closedOn, locale, true) }) }}
            </template>
          </small>
        </div>
        <button
          type="button"
          :disabled="busy"
          class="btn btn-secondary btn-sm flex-none"
          :aria-label="t(risk.closedOn === null ? 'followUp.drawer.closeRiskLabel' : 'followUp.drawer.reopenRiskLabel', { text: risk.text })"
          @click="toggle(risk)"
        >
          {{ t(risk.closedOn === null ? 'followUp.drawer.closeRisk' : 'followUp.drawer.reopenRisk') }}
        </button>
      </li>
    </ul>
    <form class="grid grid-cols-1 gap-2 sm:grid-cols-2" @submit.prevent="addRisk">
      <label class="flex flex-col gap-1 text-sm text-txt-mid sm:col-span-2">
        {{ t('followUp.drawer.riskText') }}
        <input
          v-model="riskText"
          type="text"
          required
          :maxlength="RISK_TEXT_LIMIT"
          class="field"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-txt-mid">
        {{ t('followUp.drawer.riskLevel') }}
        <select v-model="riskLevel" class="field">
          <option v-for="level in RISK_LEVELS" :key="level" :value="level">{{ t(`riskLevel.${level}`) }}</option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-sm text-txt-mid">
        {{ t('followUp.drawer.riskOwner') }}
        <input
          v-model="riskOwner"
          type="text"
          :maxlength="PERSON_LIMIT"
          class="field"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm text-txt-mid sm:col-span-2">
        {{ t('followUp.drawer.riskSubject') }}
        <select v-model="riskEpic" class="field">
          <option :value="null">{{ t('followUp.drawer.wholeProject') }}</option>
          <option v-for="subject in subjects" :key="subject.id" :value="subject.id">{{ subject.title }}</option>
        </select>
      </label>
      <button
        type="submit"
        :disabled="busy || riskText.trim() === ''"
        class="btn btn-primary btn-sm w-fit"
      >
        {{ t('followUp.drawer.addRisk') }}
      </button>
    </form>
  </section>
</template>
