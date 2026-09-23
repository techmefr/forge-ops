<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import { OWNERSHIPS, keepEpics, oneProjectOnly, type Ownership } from './EpicFilter'

const emit = defineEmits<{ chosen: [readonly number[]] }>()

const { t } = useI18n()
const say = usePhrase()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const self = useResource<{ login: string }>(() => board.read('/api/board/self'))
const epics = ref<readonly EpicOverview[]>([])
const chosenProject = ref<number | null>(null)
const ownership = ref<Ownership>('all')
const picked = ref<readonly number[]>([])
const refusal = ref<Phrase | null>(null)
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
  <div class="flex h-full min-h-0 flex-col gap-5 p-8">
    <div class="flex flex-none flex-wrap items-end gap-4">
      <label class="flex flex-col gap-1">
        <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">{{
          t('common.project')
        }}</span>
        <select
          v-model="chosenProject"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        >
          <option :value="null">{{ t('common.allProjects') }}</option>
          <option v-for="project in projects.data.value ?? []" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </label>

      <div class="flex flex-col gap-1">
        <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">{{
          t('epic.ownership')
        }}</span>
        <div class="flex gap-2">
          <button
            v-for="name in OWNERSHIPS"
            :key="name"
            type="button"
            :aria-pressed="name === ownership"
            class="rounded-md border px-3 py-2 text-[11px] font-semibold uppercase"
            :class="
              name === ownership
                ? 'border-acc bg-acc text-ink'
                : 'border-line bg-card text-txt-mid hover:border-acc'
            "
            @click="ownership = name"
          >
            {{ t(`ownership.${name}`) }}
          </button>
        </div>
      </div>

      <p class="ml-auto font-mono text-[11px] text-txt-low">
        {{ t('epic.chosenCount', { count: picked.length }, picked.length) }}
      </p>
      <button
        type="button"
        :disabled="busy || picked.length === 0 || mixed"
        class="rounded-lg border border-acc bg-acc px-4 py-2 text-sm font-bold text-ink uppercase disabled:opacity-40"
        @click="write()"
      >
        {{ t('epic.writeStories', picked.length) }}
      </button>
    </div>

    <p v-if="mixed" class="text-sm text-orange" role="alert">{{ t('epic.mixedProjects') }}</p>
    <p v-if="refusal !== null" class="text-sm text-red" role="alert">{{ say(refusal) }}</p>

    <div class="min-h-0 flex-1 overflow-auto pr-1">
    <ScreenState
      :pending="projects.pending.value"
      :failure="projects.failure.value"
      :empty="shown.length === 0"
      empty-key="epic.empty"
      @retry="projects.reload()"
    >
      <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        <article
          v-for="epic in shown"
          :key="epic.id"
          class="flex flex-col rounded-lg border bg-card p-4 transition-colors"
          :class="picked.includes(epic.id) ? 'border-acc' : 'border-line'"
        >
          <div class="flex items-center gap-2">
            <span
              class="h-3 w-3 flex-none rounded-full"
              :style="{ background: projectOf(epic.projectId)?.colour ?? 'var(--forge-line)' }"
              aria-hidden="true"
            />
            <span class="font-mono text-[11px] font-semibold text-acc">{{
              projectOf(epic.projectId)?.name ?? t('epic.unknownProject')
            }}</span>
            <label
              class="ml-auto flex min-h-[32px] cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] text-txt-low uppercase hover:bg-elev hover:text-txt-hi"
            >
              <input
                type="checkbox"
                class="h-[18px] w-[18px] accent-acc"
                :checked="picked.includes(epic.id)"
                :aria-label="t('epic.choose', { title: epic.title })"
                @change="toggle(epic.id)"
              />
              {{ t('common.take') }}
            </label>
          </div>

          <button type="button" class="mt-2 text-left" @click="toggle(epic.id)">
            <h2 class="display-italic text-[22px]">{{ epic.title }}</h2>
            <p class="mt-2 line-clamp-3 text-sm text-txt-mid">{{ epic.businessIntent }}</p>
          </button>

          <div class="mt-3 flex items-center gap-3 border-t border-line pt-3">
            <span class="font-mono text-[11px] text-txt-low">{{
              t('epic.storyCount', { count: epic.storyCount }, epic.storyCount)
            }}</span>
            <span
              class="font-mono text-[11px] uppercase"
              :class="epic.assignee === null ? 'text-green' : 'text-violet'"
              >{{ epic.assignee ?? t('epic.free') }}</span
            >
            <button
              v-if="epic.assignee === null"
              type="button"
              :disabled="busy"
              class="ml-auto font-mono text-[11px] text-acc uppercase hover:underline disabled:opacity-40"
              @click="claim(epic.id)"
            >
              {{ t('epic.claim') }}
            </button>
            <button
              v-else-if="epic.assignee === self.data.value?.login"
              type="button"
              :disabled="busy"
              class="ml-auto font-mono text-[11px] text-txt-low uppercase hover:underline disabled:opacity-40"
              @click="release(epic.id)"
            >
              {{ t('common.release') }}
            </button>
          </div>
        </article>
      </div>
    </ScreenState>
    </div>
  </div>
</template>
