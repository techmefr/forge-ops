<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import FileBrowser from './FileBrowser.vue'
import MarkLegend from './MarkLegend.vue'
import type {
  KanbanStory,
  PathConflict,
  Project,
  ScopeCollision,
  ScopeReservation,
  ZoneOverview,
} from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const chosenProject = ref<number | null>(null)
const zones = useResource<readonly ZoneOverview[]>(async () =>
  chosenProject.value === null
    ? []
    : board.read<readonly ZoneOverview[]>(`/api/projects/${chosenProject.value}/zones`),
)
const conflicts = useResource<readonly PathConflict[]>(() => board.read('/api/files/conflicts'))
const reservations = useResource<readonly ScopeReservation[]>(() =>
  board.read('/api/scope/reservations'),
)
const collisions = useResource<readonly ScopeCollision[]>(() => board.read('/api/scope/collisions'))
const kanban = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))

const claimStoryId = ref<number | null>(null)
const claimPath = ref('')
const claimSymbols = ref('')

const pathPrefix = ref('')
const zoneName = ref('')
const zoneColour = ref('#d6ff2b')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

async function declareZone(): Promise<void> {
  const projectId = chosenProject.value
  if (projectId === null) {
    refusal.value = phrase('project.chooseProject')
    return
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send('/api/zones', 'POST', {
      projectId,
      pathPrefix: pathPrefix.value,
      name: zoneName.value,
      colour: zoneColour.value,
    })
    pathPrefix.value = ''
    zoneName.value = ''
    await zones.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

async function reloadScope(): Promise<void> {
  await Promise.all([reservations.reload(), collisions.reload()])
}

async function reserveScope(): Promise<void> {
  const storyId = claimStoryId.value
  if (storyId === null) {
    refusal.value = phrase('project.chooseStoryFirst')
    return
  }
  busy.value = true
  refusal.value = null
  try {
    await board.send(`/api/stories/${storyId}/scope`, 'POST', {
      pathPrefix: claimPath.value,
      symbols: claimSymbols.value
        .split(',')
        .map((symbol) => symbol.trim())
        .filter((symbol) => symbol !== ''),
    })
    claimPath.value = ''
    claimSymbols.value = ''
    await reloadScope()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

async function releaseScope(storyId: number): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await board.send(`/api/stories/${storyId}/scope`, 'DELETE')
    await reloadScope()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

watch(chosenProject, () => void zones.reload())

onMounted(async () => {
  await Promise.all([projects.reload(), conflicts.reload(), kanban.reload(), reloadScope()])
  chosenProject.value = projects.data.value?.[0]?.id ?? null
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col overflow-auto p-8">
    <div class="flex flex-none flex-wrap items-end gap-4">
      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">
          {{ t('common.project') }}
        </span>
        <select
          v-model="chosenProject"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        >
          <option v-for="project in projects.data.value ?? []" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </label>

      <MarkLegend class="pb-2" data-tour="file-legend" />
    </div>

    <div class="mt-6 min-h-0 flex-1">
      <FileBrowser :project-id="chosenProject" />
    </div>

    <details class="mt-4 max-h-[40vh] flex-none overflow-auto rounded-2xl border border-line bg-bg/40 p-4">
      <summary class="cursor-pointer font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('project.zonesSummary') }}
      </summary>

      <div class="mt-4 flex flex-wrap items-end gap-4">
      <form class="flex flex-wrap items-end gap-2" @submit.prevent="declareZone">
        <input
          v-model="pathPrefix"
          type="text"
          :placeholder="t('project.zonePathPlaceholder')"
          :aria-label="t('project.zonePathPlaceholder')"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
        <input
          v-model="zoneName"
          type="text"
          :placeholder="t('project.zoneNamePlaceholder')"
          :aria-label="t('project.zoneNamePlaceholder')"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
        <input
          v-model="zoneColour"
          type="color"
          class="h-[38px] w-12 rounded-lg border border-line bg-card"
          :aria-label="t('project.zoneColour')"
        />
        <button
          type="submit"
          :disabled="busy"
          class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
        >
          {{ t('project.declareZone') }}
        </button>
      </form>
    </div>

    <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ say(refusal) }}</p>

    <section class="mt-6 rounded-2xl border border-line bg-card p-4" data-tour="scope-reservation">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('project.scopeReservation') }}
      </p>
      <p class="mt-1 text-xs text-txt-low">{{ t('project.scopeHint') }}</p>
      <form class="mt-3 flex flex-wrap items-end gap-2" @submit.prevent="reserveScope">
        <select
          v-model="claimStoryId"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          :aria-label="t('project.chooseStoryFirst')"
        >
          <option :value="null">{{ t('storyTab.story') }}</option>
          <option v-for="story in kanban.data.value ?? []" :key="story.id" :value="story.id">
            {{ story.reference }} · {{ story.title }}
          </option>
        </select>
        <input
          v-model="claimPath"
          type="text"
          :placeholder="t('project.scopePathPlaceholder')"
          :aria-label="t('project.scopePathPlaceholder')"
          class="min-w-[220px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
        <input
          v-model="claimSymbols"
          type="text"
          :placeholder="t('project.symbolsPlaceholder')"
          :aria-label="t('project.symbolsPlaceholder')"
          class="min-w-[220px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
        <button
          type="submit"
          :disabled="busy || claimPath === ''"
          class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ t('project.reserve') }}
        </button>
      </form>

      <p v-if="(reservations.data.value ?? []).length === 0" class="mt-3 text-xs text-txt-low">
        {{ t('project.noReservation') }}
      </p>
      <ul class="mt-3 flex flex-col gap-1.5">
        <li
          v-for="reservation in reservations.data.value ?? []"
          :key="reservation.id"
          class="flex flex-wrap items-center gap-2 text-xs"
        >
          <span class="font-mono text-[10px] text-acc">{{ reservation.storyReference }}</span>
          <span class="font-mono text-[11px] text-txt-hi">{{ reservation.pathPrefix }}</span>
          <span v-if="reservation.symbols.length > 0" class="font-mono text-[10px] text-violet">{{
            reservation.symbols.join(', ')
          }}</span>
          <button
            type="button"
            :disabled="busy"
            class="ml-auto rounded-lg border border-line bg-elev px-2 py-1 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="releaseScope(reservation.storyId)"
          >
            {{ t('common.release') }}
          </button>
        </li>
      </ul>

      <ul v-if="(collisions.data.value ?? []).length > 0" class="mt-4 flex flex-col gap-1">
        <li
          v-for="collision in collisions.data.value ?? []"
          :key="collision.reason"
          class="text-xs text-orange"
        >
          {{
            t('project.collision', {
              stories: collision.storyIds.join(', '),
              reason: collision.reason,
            })
          }}
        </li>
      </ul>
    </section>

    <section v-if="(conflicts.data.value ?? []).length > 0" class="mt-6 rounded-2xl border border-red bg-red-soft/10 p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-red uppercase">
        {{ t('project.disputedFiles') }}
      </p>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="conflict in conflicts.data.value ?? []" :key="conflict.path" class="text-xs text-txt-hi">
          <span class="font-mono text-[11px]">{{ conflict.path }}</span>
          <span class="ml-2 text-txt-low">{{
            t('project.storiesTouch', { count: conflict.storyIds.length }, conflict.storyIds.length)
          }}</span>
        </li>
      </ul>
    </section>

    <div class="mt-6">
      <ScreenState
        :pending="zones.pending.value"
        :failure="zones.failure.value"
        :empty="(zones.data.value ?? []).length === 0"
        empty-key="project.emptyZones"
        @retry="zones.reload()"
      >
        <div class="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(320px,1fr))]">
          <article
            v-for="overview in zones.data.value ?? []"
            :key="overview.zone.id"
            class="rounded-2xl border border-line bg-card p-4"
          >
            <div class="flex items-center gap-2">
              <span
                class="h-3 w-3 flex-none rounded-full"
                :style="{ background: overview.zone.colour }"
                aria-hidden="true"
              />
              <h2 class="display-italic text-base">{{ overview.zone.name }}</h2>
              <span class="ml-auto font-mono text-[10px] text-txt-low">{{
                t('project.zoneStoryCount', { count: overview.storyCount }, overview.storyCount)
              }}</span>
            </div>
            <p class="mt-1 font-mono text-[11px] text-txt-low">{{ overview.zone.pathPrefix }}</p>
            <p v-if="overview.zone.summary !== null" class="mt-2 text-xs text-txt-mid">
              {{ overview.zone.summary }}
            </p>
            <p v-else class="mt-2 text-xs text-txt-low">{{ t('project.noSummary') }}</p>

            <ul class="mt-3 flex max-h-[30vh] flex-col gap-1 overflow-y-auto">
              <li
                v-for="file in overview.files"
                :key="file.path"
                class="flex items-center gap-2 text-[11px]"
              >
                <span class="font-mono text-txt-hi">{{ file.path }}</span>
                <span class="ml-auto font-mono text-[10px] text-acc">{{ file.storyReference }}</span>
                <span v-if="file.agentName !== null" class="font-mono text-[10px] text-txt-low">{{
                  file.agentName
                }}</span>
              </li>
            </ul>
          </article>
        </div>
      </ScreenState>
      </div>
    </details>
  </div>
</template>
