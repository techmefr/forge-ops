<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { Epic, Incident, IncidentOrigin, Project } from '@/domain/Board/BoardModel'

const STATES = ['pending', 'accepted', 'refused'] as const

const STATE_LABELS: Record<string, string> = {
  pending: 'A trancher',
  accepted: 'Acceptes',
  refused: 'Refuses',
}

const chosenState = ref<(typeof STATES)[number]>('pending')
const incidents = useResource<readonly Incident[]>(() =>
  board.read(`/api/incidents?state=${chosenState.value}`),
)
const origins = useResource<readonly IncidentOrigin[]>(() => board.read('/api/origins'))
const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const epics = ref<readonly Epic[]>([])
const chosenEpic = ref<number | null>(null)
const reasons = ref<Map<number, string>>(new Map())
const refusal = ref<string | null>(null)
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
    refusal.value = 'Choisis l epique qui recevra la story'
    return Promise.resolve()
  }
  return guard(() => board.send(`/api/incidents/${incident.id}/accept`, 'POST', { epicId }))
}

function refuse(incident: Incident): Promise<void> {
  const reason = reasons.value.get(incident.id) ?? ''
  if (reason.trim() === '') {
    refusal.value = 'Un refus se motive, sinon personne ne sait pourquoi'
    return Promise.resolve()
  }
  return guard(() => board.send(`/api/incidents/${incident.id}/refuse`, 'POST', { reason }))
}

function setReason(incidentId: number, value: string): void {
  reasons.value = new Map(reasons.value).set(incidentId, value)
}

function originOf(incident: Incident): string {
  return (origins.data.value ?? []).find((origin) => origin.id === incident.originId)?.name ?? 'inconnue'
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
  <div class="p-8">
    <div class="flex flex-wrap items-end gap-3">
      <div class="flex gap-1">
        <button
          v-for="state in STATES"
          :key="state"
          type="button"
          class="rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
          :class="
            state === chosenState
              ? 'border-acc bg-acc text-ink'
              : 'border-line bg-card text-txt-mid hover:border-acc'
          "
          @click="chosenState = state"
        >
          {{ STATE_LABELS[state] }}
        </button>
      </div>

      <label class="ml-auto flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase"
          >Epique d accueil</span
        >
        <select
          v-model="chosenEpic"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        >
          <option :value="null">A choisir</option>
          <option v-for="epic in epics" :key="epic.id" :value="epic.id">{{ epic.title }}</option>
        </select>
      </label>
    </div>

    <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ refusal }}</p>

    <div class="mt-6">
      <ScreenState
        :pending="incidents.pending.value"
        :failure="incidents.failure.value"
        :empty="(incidents.data.value ?? []).length === 0"
        empty-label="Rien dans cette pile."
        @retry="incidents.reload()"
      >
        <div class="flex flex-col gap-4">
          <article
            v-for="incident in incidents.data.value ?? []"
            :key="incident.id"
            class="rounded-2xl border border-line bg-card p-4"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">{{
                originOf(incident)
              }}</span>
              <span
                v-if="incident.occurrences > 1"
                class="rounded-full bg-orange/20 px-2 py-0.5 font-mono text-[10px] text-orange"
                >{{ incident.occurrences }} fois</span
              >
              <span class="ml-auto font-mono text-[10px] text-txt-low">{{ incident.fingerprint }}</span>
            </div>
            <h2 class="display-italic mt-2 text-base">{{ incident.title }}</h2>
            <p class="mt-2 font-mono text-[11px] whitespace-pre-wrap text-txt-mid">
              {{ incident.detail }}
            </p>

            <p v-if="incident.state === 'accepted'" class="mt-3 text-xs text-green">
              Accepte, story {{ incident.storyId }} ecrite avec sa jumelle.
            </p>
            <p v-else-if="incident.state === 'refused'" class="mt-3 text-xs text-txt-mid">
              Refuse : {{ incident.refusalReason }}
            </p>

            <div v-else class="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                :disabled="busy"
                class="rounded-lg border border-acc bg-acc px-3 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
                @click="accept(incident)"
              >
                En faire une story
              </button>
              <input
                :value="reasons.get(incident.id) ?? ''"
                type="text"
                placeholder="Motif du refus"
                class="min-w-[220px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
                @input="setReason(incident.id, ($event.target as HTMLInputElement).value)"
              />
              <button
                type="button"
                :disabled="busy"
                class="rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
                @click="refuse(incident)"
              >
                Refuser
              </button>
            </div>
          </article>
        </div>
      </ScreenState>
    </div>
  </div>
</template>
