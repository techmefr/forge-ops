<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import type { BoardPreferences } from '@contract/PreferenceContract'
import type { Project } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import { readPreference, writePreference } from '@/technical/Appearance/Preference'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { tintOf } from '@/technical/Ui/Tint'
import WorkflowBar from '@/domain/Workflow/WorkflowBar.vue'
import WorkflowEmptyState from '@/domain/Workflow/WorkflowEmptyState.vue'
import { useProjectWorkflow } from '@/domain/Workflow/UseProjectWorkflow'
import { starterSteps, templateLabelKey } from '@/domain/Workflow/WorkflowRule'
import ForgeDrawer from './ForgeDrawer.vue'
import ForgeKanban from './ForgeKanban.vue'
import ForgePipeline from './ForgePipeline.vue'
import ForgeResourceBar from './ForgeResourceBar.vue'
import ForgeResourceDrawer from './ForgeResourceDrawer.vue'
import {
  DEFAULT_FORGE_VIEW,
  FORGE_PROJECT_KEY,
  FORGE_VIEW_KEY,
  FORGE_VIEWS,
  activeProjectOf,
  boardSteps,
  filterBySubject,
  holdableSubjects,
  firstStepKey,
  isLastStep,
  type BoardStep,
  type CardAction,
  type ForgeView,
} from './ForgeRule'
import { useForgeBoard } from './UseForgeBoard'

const { t } = useI18n()
const say = usePhrase()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))

const view = ref<ForgeView>(readPreference(FORGE_VIEW_KEY, FORGE_VIEWS, DEFAULT_FORGE_VIEW))
const projectId = ref<number | null>(null)
const subjectId = ref<number | null>(null)
const openedId = ref<number | null>(null)
const resourcesOpen = ref(false)
const announcement = ref('')
const newTitle = ref('')
const newSubject = ref<number | null>(null)
const selfLogin = ref<string | null>(null)

const forge = useForgeBoard(() => projectId.value)
const starter = useProjectWorkflow(() => projectId.value ?? 0)

const project = computed(() => (projects.data.value ?? []).find((candidate) => candidate.id === projectId.value) ?? null)
const columns = computed(() => forge.workflow.value?.columns ?? [])
const steps = computed<readonly BoardStep[]>(() =>
  boardSteps(columns.value, { backlog: t('forge.backlog'), done: t('forge.done') }),
)
const visible = computed(() => filterBySubject(forge.cards.value, subjectId.value))
const addable = computed(() => holdableSubjects(forge.subjects.value, selfLogin.value))
const opened = computed(() => forge.cards.value.find((card) => card.id === openedId.value) ?? null)
const noWorkflow = computed(() => forge.workflow.value !== null && columns.value.length === 0)
const projectName = computed(() => project.value?.name ?? '')

async function adoptStoredView(): Promise<void> {
  try {
    const stored = await board.read<BoardPreferences | undefined>('/api/board/preferences')
    const choice = FORGE_VIEWS.find((candidate) => candidate === stored?.forgeView)
    if (choice !== undefined) {
      view.value = choice
      writePreference(FORGE_VIEW_KEY, choice)
    }
  } catch {
    return
  }
}

async function rememberView(next: ForgeView): Promise<void> {
  try {
    await board.send('/api/board/preferences', 'PUT', { forgeView: next })
  } catch {
    return
  }
}

function chooseView(next: ForgeView): void {
  view.value = next
  writePreference(FORGE_VIEW_KEY, next)
  void rememberView(next)
}

function chooseProject(id: number): void {
  projectId.value = id
  writePreference(FORGE_PROJECT_KEY, String(id))
}

function stepLabel(key: string): string {
  return steps.value.find((step) => step.key === key)?.label ?? key
}

async function move(card: ForgeCardView, stepKey: string): Promise<void> {
  const moved = await forge.move(card, stepKey)
  if (moved !== null) {
    announcement.value = t(moved.started ? 'forge.movedAndStarted' : 'forge.movedTo', {
      title: card.title,
      step: stepLabel(stepKey),
    })
  }
}

async function act(card: ForgeCardView, action: CardAction): Promise<void> {
  if (action === 'stop') {
    await forge.stop(card)
    return
  }
  if (action === 'validate') {
    const index = steps.value.findIndex((step) => step.key === card.stepKey)
    const next = steps.value[index + 1]
    if (next !== undefined && next.kind === 'step') {
      await move(card, next.key)
      return
    }
    if (isLastStep(steps.value, card) && (await forge.finish(card))) {
      announcement.value = t('forge.finished', { title: card.title })
    }
    return
  }
  if (card.stepKey === 'backlog') {
    const first = firstStepKey(steps.value)
    if (first !== null) {
      await move(card, first)
    }
    return
  }
  const launched = await forge.launch(card)
  if (launched !== null) {
    announcement.value = t('forge.movedAndStarted', { title: card.title, step: stepLabel(card.stepKey) })
  }
}

async function addStory(): Promise<void> {
  const title = newTitle.value.trim()
  const subject = newSubject.value
  if (title === '' || subject === null) {
    return
  }
  if (await forge.addStory(subject, title)) {
    newTitle.value = ''
  }
}

async function createStarter(): Promise<void> {
  const created = await starter.createMany(
    starterSteps((template) => t(templateLabelKey(template))),
  )
  if (created) {
    await forge.load()
  }
}

watch(addable, (list) => {
  if (!list.some((subject) => subject.id === newSubject.value)) {
    newSubject.value = list[0]?.id ?? null
  }
})

async function readSelf(): Promise<void> {
  try {
    const self = await board.read<{ login?: string } | undefined>('/api/board/self')
    selfLogin.value = typeof self?.login === 'string' ? self.login : null
  } catch {
    selfLogin.value = null
  }
}

watch(projectId, () => {
  subjectId.value = null
  openedId.value = null
  void forge.load().then(() => {
    newSubject.value = addable.value[0]?.id ?? null
  })
})

onMounted(async () => {
  void adoptStoredView()
  void readSelf()
  await projects.reload()
  const list = projects.data.value ?? []
  projectId.value = activeProjectOf(list, readPreference(FORGE_PROJECT_KEY, list.map((entry) => String(entry.id)), ''))
})
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto" data-test="forge-screen">
    <ForgeResourceBar @details="resourcesOpen = true" />

    <p
      v-if="projectId === null && !projects.pending.value"
      class="m-0 px-4 py-6 text-sm text-txt-mid"
      data-test="forge-no-project"
    >
      {{ t('forge.noProject') }}
    </p>

    <template v-if="projectId !== null">
      <div class="flex min-w-0 flex-none flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3">
        <h2 class="sr-only">{{ t('forge.title') }}</h2>
        <small class="ml-auto text-[11px] text-txt-low">{{ t('forge.viewKept') }}</small>
        <div class="flex rounded-md border border-line" role="group" :aria-label="t('forge.viewAria')">
          <button
            v-for="choice in FORGE_VIEWS"
            :key="choice"
            type="button"
            class="border-0 bg-transparent px-3 py-1 font-mono text-[11px] first:rounded-l-md last:rounded-r-md"
            :class="view === choice ? 'bg-elev text-txt-hi' : 'text-txt-mid hover:bg-elev'"
            :aria-pressed="view === choice"
            @click="chooseView(choice)"
          >
            {{ choice === 'kanban' ? t('forge.viewKanban') : t('forge.viewPipeline') }}
          </button>
        </div>
      </div>

      <div class="flex min-w-0 flex-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div class="flex min-w-0 flex-wrap gap-1.5" role="group" :aria-label="t('forge.projectsAria')">
          <button
            v-for="entry in projects.data.value ?? []"
            :key="entry.id"
            type="button"
            class="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px]"
            :class="entry.id === projectId ? 'border-acc text-txt-hi' : 'border-line text-txt-mid hover:bg-elev'"
            :aria-pressed="entry.id === projectId"
            @click="chooseProject(entry.id)"
          >
            <span class="h-2 w-2 rounded-full" :style="{ background: tintOf(entry.colour) }" aria-hidden="true" />
            {{ entry.name }}
          </button>
        </div>
        <select
          v-model="subjectId"
          class="max-w-full rounded-md border border-line bg-card px-2 py-1 text-[11px] text-txt-hi"
          :aria-label="t('forge.subjectFilter')"
        >
          <option :value="null">{{ t('forge.allSubjects') }}</option>
          <option v-for="subject in forge.subjects.value" :key="subject.id" :value="subject.id">
            {{ subject.title }}
          </option>
        </select>
        <WorkflowBar :project-id="projectId" :project-name="projectName" @changed="forge.load()" />
      </div>

      <form
        v-if="addable.length > 0"
        class="flex min-w-0 flex-none flex-wrap items-center gap-2 px-4 pb-3"
        @submit.prevent="addStory"
      >
        <input
          v-model="newTitle"
          type="text"
          maxlength="200"
          class="min-w-[12rem] flex-1 rounded-md border border-line bg-card px-2.5 py-1 text-sm text-txt-hi"
          :placeholder="t('forge.addStory')"
          :aria-label="t('forge.addStoryTitle')"
        />
        <select
          v-model="newSubject"
          class="max-w-full rounded-md border border-line bg-card px-2 py-1 text-[11px] text-txt-hi"
          :aria-label="t('forge.addStorySubject')"
        >
          <option v-for="subject in addable" :key="subject.id" :value="subject.id">
            {{ subject.title }}
          </option>
        </select>
        <button
          type="submit"
          class="rounded-md border border-line bg-transparent px-3 py-1 font-mono text-[11px] text-txt-hi hover:bg-elev disabled:opacity-40"
          :disabled="newTitle.trim() === ''"
        >
          {{ t('forge.addStoryButton') }}
        </button>
      </form>
      <p v-else-if="forge.workflow.value !== null" class="m-0 px-4 pb-3 text-[11px] text-txt-low">
        {{ t('forge.noSubject') }}
      </p>

      <p v-if="forge.failure.value !== null" class="m-0 px-4 pb-2 text-sm text-red" role="alert">
        {{ say(forge.failure.value) }}
      </p>
      <ul v-if="forge.gaps.value.length > 0" class="m-0 list-disc px-8 pb-2 text-sm text-red">
        <li v-for="gap in forge.gaps.value" :key="gap.key">{{ say(gap) }}</li>
      </ul>
      <p class="sr-only" role="status" aria-live="polite">{{ announcement }}</p>

      <div v-if="noWorkflow" class="flex-none px-4">
        <WorkflowEmptyState
          :project-name="projectName"
          :admin="forge.workflow.value?.admin ?? null"
          :may-settle="forge.workflow.value?.maySettle ?? false"
          :busy="starter.busy.value"
          @create="createStarter"
        />
      </div>

      <p v-if="forge.pending.value" class="m-0 px-4 text-[11px] text-txt-low">{{ t('forge.loading') }}</p>

      <div class="min-h-[26rem] min-w-0 flex-1 px-4 pb-4">
        <ForgeKanban
          v-if="view === 'kanban'"
          :steps="steps"
          :cards="visible"
          :busy="forge.busy.value"
          @open="(card) => (openedId = card.id)"
          @move="move"
          @act="act"
        />
        <ForgePipeline
          v-else
          :steps="steps"
          :cards="visible"
          :busy="forge.busy.value"
          :project-name="projectName"
          @open="(card) => (openedId = card.id)"
          @act="act"
        />
      </div>
    </template>

    <ForgeDrawer
      v-if="opened !== null"
      :key="opened.id"
      :card="opened"
      :steps="steps"
      :project-name="projectName"
      :busy="forge.busy.value.has(opened.id)"
      @close="openedId = null"
      @act="(action) => act(opened!, action)"
      @settled="forge.refresh()"
    />
    <ForgeResourceDrawer v-if="resourcesOpen" @close="resourcesOpen = false" />
  </div>
</template>
