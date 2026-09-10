<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import {
  OWNERSHIPS,
  OWNERSHIP_LABELS,
  keepEpics,
  oneProjectOnly,
  type Ownership,
} from './EpicFilter'

const emit = defineEmits<{ chosen: [readonly number[]] }>()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const self = useResource<{ login: string }>(() => board.read('/api/board/self'))
const epics = ref<readonly EpicOverview[]>([])
const chosenProject = ref<number | null>(null)
const ownership = ref<Ownership>('all')
const picked = ref<readonly number[]>([])
const refusal = ref<string | null>(null)
const busy = ref(false)

const shown = computed(() =>
  keepEpics(epics.value, {
    projectId: chosenProject.value,
    ownership: ownership.value,
    self: self.data.value?.login ?? '',
  }),
)

const mixed = computed(() => !oneProjectOnly(epics.value, picked.value))

const projectOf = computed(
  () => (projectId: number) =>
    (projects.data.value ?? []).find((project) => project.id === projectId) ?? null,
)

async function loadEpics(): Promise<void> {
  const found = await Promise.all(
    (projects.data.value ?? []).map((project) =>
      board.read<readonly EpicOverview[]>(`/api/projects/${project.id}/epics`),
    ),
  )
  epics.value = found.flat()
}

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function toggle(epicId: number): void {
  picked.value = picked.value.includes(epicId)
    ? picked.value.filter((id) => id !== epicId)
    : [...picked.value, epicId]
}

function claim(epicId: number): Promise<void> {
  return guard(async () => {
    await board.send(`/api/epics/${epicId}/claim`, 'POST')
    await loadEpics()
  })
}

function release(epicId: number): Promise<void> {
  return guard(async () => {
    await board.send(`/api/epics/${epicId}/claim`, 'DELETE')
    await loadEpics()
  })
}

function write(): void {
  if (picked.value.length === 0 || mixed.value) {
    return
  }
  emit('chosen', picked.value)
}

onMounted(async () => {
  await Promise.all([projects.reload(), self.reload()])
  await guard(loadEpics)
})
</script>

<template>
  <div class="flex flex-col gap-5 p-8">
    <div class="flex flex-wrap items-end gap-4">
      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Projet</span>
        <select
          v-model="chosenProject"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        >
          <option :value="null">Tous</option>
          <option v-for="project in projects.data.value ?? []" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </label>

      <div class="flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Attribution</span>
        <div class="flex gap-2">
          <button
            v-for="name in OWNERSHIPS"
            :key="name"
            type="button"
            :aria-pressed="name === ownership"
            class="rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase"
            :class="
              name === ownership
                ? 'border-acc bg-acc text-ink'
                : 'border-line bg-card text-txt-mid hover:border-acc'
            "
            @click="ownership = name"
          >
            {{ OWNERSHIP_LABELS[name] }}
          </button>
        </div>
      </div>

      <p class="ml-auto font-mono text-[11px] text-txt-low">
        {{ picked.length }} choisie{{ picked.length > 1 ? 's' : '' }}
      </p>
      <button
        type="button"
        :disabled="busy || picked.length === 0 || mixed"
        class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        @click="write()"
      >
        Ecrire les stories
      </button>
    </div>

    <p v-if="mixed" class="text-xs text-orange" role="alert">
      Une meme fournee ne peut pas melanger deux projets. Retire une epique.
    </p>
    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ refusal }}</p>

    <ScreenState
      :pending="projects.pending.value"
      :failure="projects.failure.value"
      :empty="shown.length === 0"
      empty-label="Aucune epique sous ce filtre."
      @retry="projects.reload()"
    >
      <ul class="flex flex-col gap-2">
        <li
          v-for="epic in shown"
          :key="epic.id"
          class="flex items-start gap-3 rounded-xl border bg-card p-4"
          :class="picked.includes(epic.id) ? 'border-acc' : 'border-line'"
        >
          <input
            type="checkbox"
            class="mt-1"
            :checked="picked.includes(epic.id)"
            :aria-label="`Choisir ${epic.title}`"
            @change="toggle(epic.id)"
          />
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span
                class="h-2 w-2 flex-none rounded-full"
                :style="{ background: projectOf(epic.projectId)?.colour ?? 'var(--forge-line)' }"
                aria-hidden="true"
              />
              <span class="font-mono text-[10px] text-txt-low uppercase">{{
                projectOf(epic.projectId)?.name ?? 'Projet inconnu'
              }}</span>
              <span class="ml-2 font-mono text-[10px] text-txt-low"
                >{{ epic.storyCount }} {{ epic.storyCount > 1 ? 'stories' : 'story' }}</span
              >
            </div>
            <p class="display-italic mt-1 text-base">{{ epic.title }}</p>
            <p class="mt-1 text-xs text-txt-mid">{{ epic.businessIntent }}</p>
          </div>
          <div class="flex flex-none flex-col items-end gap-2">
            <span
              class="font-mono text-[10px] uppercase"
              :class="epic.assignee === null ? 'text-green' : 'text-violet'"
              >{{ epic.assignee ?? 'Libre' }}</span
            >
            <button
              v-if="epic.assignee === null"
              type="button"
              :disabled="busy"
              class="rounded-lg border border-line bg-elev px-3 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40 hover:border-acc"
              @click="claim(epic.id)"
            >
              Prendre
            </button>
            <button
              v-else-if="epic.assignee === self.data.value?.login"
              type="button"
              :disabled="busy"
              class="rounded-lg border border-line bg-elev px-3 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40 hover:border-acc"
              @click="release(epic.id)"
            >
              Rendre
            </button>
          </div>
        </li>
      </ul>
    </ScreenState>
  </div>
</template>
