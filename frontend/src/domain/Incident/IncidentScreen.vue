<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import {
  INCIDENT_STATE_SEQUENCE,
  type Epic,
  type Incident,
  type IncidentOrigin,
  type IncidentState,
  type Project,
} from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const chosenState = ref<IncidentState>('pending')
const incidents = useResource<readonly Incident[]>(() =>
  board.read(`/api/incidents?state=${chosenState.value}`),
)
const origins = useResource<readonly IncidentOrigin[]>(() => board.read('/api/origins'))
const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const epics = ref<readonly Epic[]>([])
const chosenEpic = ref<number | null>(null)
const reasons = ref<Map<number, string>>(new Map())
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
    await incidents.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function accept(incident: Incident): Promise<void> {
  const epicId = chosenEpic.value
  if (epicId === null) {
    refusal.value = phrase('incident.chooseEpicFirst')
    return Promise.resolve()
  }
  return guard(() => board.send(`/api/incidents/${incident.id}/accept`, 'POST', { epicId }))
}

function refuse(incident: Incident): Promise<void> {
  const reason = reasons.value.get(incident.id) ?? ''
  if (reason.trim() === '') {
    refusal.value = phrase('incident.refusalNeedsReason')
    return Promise.resolve()
  }
  return guard(() => board.send(`/api/incidents/${incident.id}/refuse`, 'POST', { reason }))
}

function setReason(incidentId: number, value: string): void {
  reasons.value = new Map(reasons.value).set(incidentId, value)
}

function originOf(incident: Incident): string {
  return (
    (origins.data.value ?? []).find((origin) => origin.id === incident.originId)?.name ??
    t('incident.unknownOrigin')
  )
}

async function loadEpics(): Promise<void> {
  const found: Epic[] = []
  for (const project of projects.data.value ?? []) {
    found.push(...(await board.read<readonly Epic[]>(`/api/projects/${project.id}/epics`)))
  }
  epics.value = found
}

watch(chosenState, () => void incidents.reload())

onMounted(async () => {
  await Promise.all([incidents.reload(), origins.reload(), projects.reload()])
  await loadEpics()
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-8">
    <div class="flex flex-none flex-wrap items-end gap-3">
      <div class="flex gap-1">
        <button
          v-for="state in INCIDENT_STATE_SEQUENCE"
          :key="state"
          type="button"
          :aria-pressed="state === chosenState"
          class="rounded-lg px-3 py-2 text-xs font-semibold"
          :class="state === chosenState ? 'bg-acc text-ink' : 'bg-card text-txt-mid hover:bg-elev'"
          @click="chosenState = state"
        >
          {{ t(`incidentState.${state}`) }}
        </button>
      </div>

      <label class="ml-auto flex flex-col gap-1">
        <span class="text-xs text-txt-low">{{
          t('incident.epicTarget')
        }}</span>
        <select
          v-model="chosenEpic"
          class="field"
        >
          <option :value="null">{{ t('incident.toChoose') }}</option>
          <option v-for="epic in epics" :key="epic.id" :value="epic.id">{{ epic.title }}</option>
        </select>
      </label>
    </div>

    <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ say(refusal) }}</p>

    <div class="mt-6 min-h-0 flex-1 overflow-auto pr-1">
      <ScreenState
        :pending="incidents.pending.value"
        :failure="incidents.failure.value"
        :empty="(incidents.data.value ?? []).length === 0"
        empty-key="incident.empty"
        @retry="incidents.reload()"
      >
        <div class="flex flex-col gap-4">
          <article
            v-for="incident in incidents.data.value ?? []"
            :key="incident.id"
            class="card p-4"
          >
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-xs text-txt-low">{{
                originOf(incident)
              }}</span>
              <span
                v-if="incident.occurrences > 1"
                class="rounded-full bg-orange/20 px-2 py-0.5 tabular-nums text-xs text-orange"
                >{{
                  t('incident.occurrences', { count: incident.occurrences }, incident.occurrences)
                }}</span
              >
              <span class="ml-auto font-mono text-xs text-txt-low">{{ incident.fingerprint }}</span>
            </div>
            <h2 class="title-face mt-2 text-lg">{{ incident.title }}</h2>
            <p class="mt-2 font-mono text-xs whitespace-pre-wrap text-txt-mid">
              {{ incident.detail }}
            </p>

            <p v-if="incident.state === 'accepted'" class="mt-3 text-sm text-green">
              {{ t('incident.accepted', { storyId: incident.storyId ?? '' }) }}
            </p>
            <p v-else-if="incident.state === 'refused'" class="mt-3 text-sm text-txt-mid">
              {{ t('incident.refused', { reason: incident.refusalReason ?? '' }) }}
            </p>

            <div v-else class="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                :disabled="busy"
                class="btn btn-primary btn-sm"
                @click="accept(incident)"
              >
                {{ t('incident.makeStory') }}
              </button>
              <input
                :value="reasons.get(incident.id) ?? ''"
                type="text"
                :placeholder="t('incident.refusalPlaceholder')"
                class="field min-w-[220px] flex-1"
                @input="setReason(incident.id, ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                :disabled="busy"
                class="btn btn-secondary btn-sm"
                @click="refuse(incident)"
              >
                {{ t('common.refuse') }}
              </button>
            </div>
          </article>
        </div>
      </ScreenState>
    </div>
  </div>
</template>
