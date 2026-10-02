<script setup lang="ts">
import { safeHref } from '@/technical/Ui/SafeHref'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import { tintOf } from '@/technical/Ui/Tint'
import type { EpicOverview } from '@/domain/Board/BoardModel'
import EventDialog from '@/domain/Roadmap/EventDialog.vue'
import { EVENT_TONES } from '@/domain/Roadmap/EventTone'
import { localDay } from '@/domain/Roadmap/Timeline'
import { subjectOf, type RoadmapProject } from '@/domain/Roadmap/UseRoadmap'
import type { SubjectLink } from '@contract/EpicContract'
import { minutesToWrite, type ProjectEvent } from '@contract/EventContract'
import {
  DECISION_TEXT_LIMIT,
  PERSON_LIMIT,
  RISK_LEVELS,
  RISK_TEXT_LIMIT,
  STATUS_SENTENCE_LIMIT,
  WEATHERS,
  computedWeather,
  type ProjectRisk,
  type RiskLevel,
} from '@contract/FollowUpContract'
import { dayLabel } from './DayLabel'
import type { ProjectWeather } from './UseFollowUps'

const props = defineProps<{ entry: ProjectWeather }>()
const emit = defineEmits<{ close: []; changed: [] }>()

const { t, locale } = useI18n()
const say = usePhrase()

const projectId = computed(() => props.entry.project.id)
const followUp = computed(() => props.entry.followUp)
const today = ref(localDay(new Date()))

const subjects = useResource(() => board.read<readonly EpicOverview[]>(`/api/projects/${projectId.value}/epics`))
const links = useResource(() => board.read<readonly SubjectLink[]>(`/api/projects/${projectId.value}/links`))
subjects.reload()
links.reload()

const sentence = ref('')
const riskText = ref('')
const riskLevel = ref<RiskLevel>('medium')
const riskOwner = ref('')
const riskEpic = ref<number | null>(null)
const decisionText = ref('')
const decisionBy = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const dialog = ref<{ event: ProjectEvent | null } | null>(null)

watch(
  () => followUp.value.statusSentence,
  (value) => {
    sentence.value = value ?? ''
  },
  { immediate: true },
)

const openRisks = computed(() => followUp.value.risks.filter((risk) => risk.closedOn === null))
const sortedEvents = computed(() =>
  [...followUp.value.events].sort((one, other) => other.date.localeCompare(one.date)),
)
const knownSubjects = computed(() => subjects.data.value ?? [])
const dialogProjects = computed<readonly RoadmapProject[]>(() => [
  {
    project: props.entry.project,
    subjects: knownSubjects.value.map(subjectOf),
    events: followUp.value.events,
    links: links.data.value ?? [],
  },
])

function weatherWord(weather: string): string {
  return t(`weather.${weather}`)
}

function subjectTitle(epicId: number | null): string | null {
  return knownSubjects.value.find((subject) => subject.id === epicId)?.title ?? null
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

function typeLabel(event: ProjectEvent): string {
  return t(`milestone.${event.type}`)
}

function eventName(event: ProjectEvent): string {
  return event.title === '' ? typeLabel(event) : event.title
}

async function guard(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true
  refusal.value = null
  try {
    await action()
    emit('changed')
    return true
  } catch (error) {
    refusal.value = reasonOf(error)
    return false
  } finally {
    busy.value = false
  }
}

function chooseWeather(event: Event): void {
  const chosen = (event.target as HTMLSelectElement).value
  void guard(() =>
    board.send(`/api/projects/${projectId.value}/weather`, 'PUT', { weather: chosen === '' ? null : chosen }),
  )
}

function saveSentence(): Promise<boolean> {
  return guard(() =>
    board.send(`/api/projects/${projectId.value}/weather`, 'PUT', {
      statusSentence: sentence.value.trim() === '' ? null : sentence.value,
    }),
  )
}

async function addRisk(): Promise<void> {
  const done = await guard(() =>
    board.send(`/api/projects/${projectId.value}/risks`, 'POST', {
      text: riskText.value,
      level: riskLevel.value,
      owner: riskOwner.value.trim() === '' ? null : riskOwner.value,
      epicId: riskEpic.value,
    }),
  )
  if (done) {
    riskText.value = ''
    riskOwner.value = ''
    riskEpic.value = null
  }
}

function toggleRisk(risk: ProjectRisk): Promise<boolean> {
  return guard(() => board.send(`/api/risks/${risk.id}`, 'PATCH', { closed: risk.closedOn === null }))
}

async function addDecision(): Promise<void> {
  const done = await guard(() =>
    board.send(`/api/projects/${projectId.value}/decisions`, 'POST', {
      text: decisionText.value,
      ...(decisionBy.value.trim() === '' ? {} : { decidedBy: decisionBy.value }),
    }),
  )
  if (done) {
    decisionText.value = ''
    decisionBy.value = ''
  }
}

function eventSaved(): void {
  dialog.value = null
  emit('changed')
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    emit('close')
  }
}
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed inset-y-0 right-0 z-50 flex w-[min(540px,100vw)] flex-col gap-4 overflow-y-auto border-l border-hair bg-panel p-5"
        data-test-id="follow-up-drawer"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <DialogTitle class="title-face flex items-center gap-2 text-lg text-txt-hi">
              <span
                class="size-2.5 flex-none rounded-full"
                :style="{ background: tintOf(entry.project.colour) }"
                aria-hidden="true"
              />
              {{ t('followUp.drawer.title', { project: entry.project.name }) }}
            </DialogTitle>
            <DialogDescription class="mt-1 text-sm text-txt-mid">
              {{ t('followUp.drawer.description') }}
            </DialogDescription>
          </div>
          <button
            type="button"
            class="flex-none rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-txt-mid hover:border-acc"
            @click="emit('close')"
          >
            {{ t('followUp.drawer.close') }}
          </button>
        </div>

        <p v-if="refusal !== null" class="rounded-lg border border-red bg-red-soft/10 p-3 text-sm text-txt-hi" role="alert">
          {{ say(refusal) }}
        </p>

        <section class="flex flex-col gap-2" :aria-labelledby="`fu-weather-${projectId}`">
          <h3 :id="`fu-weather-${projectId}`" class="text-xs text-txt-low">
            {{ t('followUp.drawer.weatherSection') }}
          </h3>
          <label class="flex flex-col gap-1 text-sm text-txt-mid">
            {{ t('followUp.drawer.weatherField') }}
            <select
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              :value="followUp.source === 'manual' ? followUp.weather : ''"
              :disabled="busy"
              data-test-id="weather-select"
              @change="chooseWeather"
            >
              <option value="">
                {{ t('followUp.drawer.automatic', { weather: weatherWord(computedWeather(followUp.score)) }) }}
              </option>
              <option v-for="weather in WEATHERS" :key="weather" :value="weather">
                {{ weatherWord(weather) }}
              </option>
            </select>
          </label>
          <p class="text-xs text-txt-mid" data-test-id="weather-now">
            {{ weatherWord(followUp.weather) }} ·
            {{ t(followUp.source === 'manual' ? 'followUp.manual' : 'followUp.computed') }} ·
            {{ t('followUp.drawer.scoreDetail', followUp.score) }}
          </p>
          <label class="flex flex-col gap-1 text-sm text-txt-mid">
            {{ t('followUp.drawer.statusLabel') }}
            <textarea
              v-model="sentence"
              rows="2"
              :maxlength="STATUS_SENTENCE_LIMIT"
              :placeholder="t('followUp.drawer.statusPlaceholder')"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
          </label>
          <button
            type="button"
            :disabled="busy"
            class="w-fit rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-txt-mid hover:border-acc disabled:opacity-40"
            @click="saveSentence"
          >
            {{ t('followUp.drawer.saveStatus') }}
          </button>
        </section>

        <section class="flex flex-col gap-2" :aria-labelledby="`fu-risks-${projectId}`">
          <h3 :id="`fu-risks-${projectId}`" class="text-xs text-txt-low">
            {{ t('followUp.drawer.risksSection', { count: openRisks.length }) }}
          </h3>
          <p v-if="followUp.risks.length === 0" class="text-sm text-txt-low">{{ t('followUp.drawer.noRisks') }}</p>
          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="risk in followUp.risks"
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
                class="flex-none rounded-lg border border-line bg-elev px-2.5 py-1 text-xs font-bold text-txt-mid hover:border-acc disabled:opacity-40"
                :aria-label="t(risk.closedOn === null ? 'followUp.drawer.closeRiskLabel' : 'followUp.drawer.reopenRiskLabel', { text: risk.text })"
                @click="toggleRisk(risk)"
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
                class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm text-txt-mid">
              {{ t('followUp.drawer.riskLevel') }}
              <select v-model="riskLevel" class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi">
                <option v-for="level in RISK_LEVELS" :key="level" :value="level">{{ t(`riskLevel.${level}`) }}</option>
              </select>
            </label>
            <label class="flex flex-col gap-1 text-sm text-txt-mid">
              {{ t('followUp.drawer.riskOwner') }}
              <input
                v-model="riskOwner"
                type="text"
                :maxlength="PERSON_LIMIT"
                class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm text-txt-mid sm:col-span-2">
              {{ t('followUp.drawer.riskSubject') }}
              <select v-model="riskEpic" class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi">
                <option :value="null">{{ t('followUp.drawer.wholeProject') }}</option>
                <option v-for="subject in knownSubjects" :key="subject.id" :value="subject.id">{{ subject.title }}</option>
              </select>
            </label>
            <button
              type="submit"
              :disabled="busy || riskText.trim() === ''"
              class="w-fit rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink disabled:opacity-40"
            >
              {{ t('followUp.drawer.addRisk') }}
            </button>
          </form>
        </section>

        <section class="flex flex-col gap-2" :aria-labelledby="`fu-decisions-${projectId}`">
          <h3 :id="`fu-decisions-${projectId}`" class="text-xs text-txt-low">
            {{ t('followUp.drawer.decisionsSection') }}
          </h3>
          <p v-if="followUp.decisions.length === 0" class="text-sm text-txt-low">{{ t('followUp.drawer.noDecisions') }}</p>
          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="decision in followUp.decisions"
              :key="decision.id"
              class="flex items-start gap-2 rounded-lg bg-card p-2.5"
            >
              <span class="flex-none font-mono text-xs text-txt-mid">
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
                class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              />
            </label>
            <label class="flex flex-col gap-1 text-sm text-txt-mid">
              {{ t('followUp.drawer.decisionBy') }}
              <input
                v-model="decisionBy"
                type="text"
                :maxlength="PERSON_LIMIT"
                class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              />
            </label>
            <button
              type="submit"
              :disabled="busy || decisionText.trim() === ''"
              class="w-fit self-end rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink disabled:opacity-40"
            >
              {{ t('followUp.drawer.addDecision') }}
            </button>
          </form>
        </section>

        <section class="flex flex-col gap-2" :aria-labelledby="`fu-meetings-${projectId}`">
          <h3 :id="`fu-meetings-${projectId}`" class="text-xs text-txt-low">
            {{ t('followUp.drawer.meetingsSection') }}
          </h3>
          <p v-if="sortedEvents.length === 0" class="text-sm text-txt-low">{{ t('followUp.drawer.noEvents') }}</p>
          <ul v-else class="flex flex-col gap-2">
            <li
              v-for="event in sortedEvents"
              :key="event.id"
              class="flex items-start gap-2 rounded-lg bg-card p-2.5"
              :data-test-id="`event-${event.id}`"
            >
              <span class="flex-none text-xs font-bold" :class="EVENT_TONES[event.type].text">
                {{ typeLabel(event) }}
              </span>
              <div class="min-w-0 flex-1">
                <b class="text-sm text-txt-hi">{{ eventName(event) }}</b>
                <small class="block text-xs text-txt-mid">
                  {{ dayLabel(event.date, locale, true) }}
                  <template v-if="subjectTitle(event.epicId) !== null"> · {{ subjectTitle(event.epicId) }}</template>
                </small>
                <p v-if="event.minutes !== null" class="mt-1 text-xs whitespace-pre-line text-txt-mid">{{ event.minutes }}</p>
                <span
                  v-else-if="minutesToWrite(event, today)"
                  class="mt-1 inline-block rounded border border-orange px-1.5 text-xs font-bold text-orange"
                >
                  {{ t('followUp.drawer.minutesToWrite') }}
                </span>
                <span v-else class="mt-1 block text-xs text-txt-low">{{ t('followUp.drawer.upcoming') }}</span>
              </div>
              <button
                type="button"
                class="flex-none rounded-lg border border-line bg-elev px-2.5 py-1 text-xs font-bold text-txt-mid hover:border-acc"
                :aria-label="`${t(event.minutes === null && minutesToWrite(event, today) ? 'followUp.drawer.writeMinutes' : 'followUp.drawer.editMinutes')} · ${eventName(event)}`"
                @click="dialog = { event }"
              >
                {{ t(event.minutes === null && minutesToWrite(event, today) ? 'followUp.drawer.writeMinutes' : 'followUp.drawer.editMinutes') }}
              </button>
            </li>
          </ul>
          <button
            type="button"
            class="w-fit rounded-lg border border-line bg-card px-3 py-1.5 text-xs font-bold text-txt-mid hover:border-acc"
            @click="dialog = { event: null }"
          >
            {{ t('followUp.drawer.newEvent') }}
          </button>
        </section>

        <section class="flex flex-col gap-2" :aria-labelledby="`fu-links-${projectId}`">
          <h3 :id="`fu-links-${projectId}`" class="text-xs text-txt-low">
            {{ t('followUp.drawer.linksSection') }}
          </h3>
          <p v-if="(links.data.value ?? []).length === 0" class="text-sm text-txt-low">{{ t('followUp.drawer.noLinks') }}</p>
          <ul v-else class="flex flex-wrap gap-2">
            <li v-for="link in links.data.value ?? []" :key="`${link.kind}-${link.url}`">
              <a
                :href="safeHref(link.url)"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded border border-line px-2 py-1 text-xs text-info hover:border-acc max-sm:inline-flex max-sm:min-h-10 max-sm:min-w-10 max-sm:items-center max-sm:justify-center"
              >
                {{ t(`linkKind.${link.kind}`) }}
              </a>
            </li>
          </ul>
        </section>

        <EventDialog
          v-if="dialog !== null"
          :projects="dialogProjects"
          :event="dialog.event"
          :project-id="projectId"
          :epic-id="dialog.event?.epicId ?? null"
          :today="today"
          @close="dialog = null"
          @saved="eventSaved"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
