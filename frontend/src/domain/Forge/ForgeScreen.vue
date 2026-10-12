<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ForgeCardView } from '@contract/ForgeCardContract'
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
import ForgeFlow from './ForgeFlow.vue'
import {
  FORGE_PROJECT_KEY,
  activeProjectOf,
  boardSteps,
  filterBySubject,
  holdableSubjects,
  firstStepKey,
  lanesOf,
  isLastStep,
  type BoardStep,
  type CardAction,
} from './ForgeRule'
import { useForgeBoard } from './UseForgeBoard'

const { t } = useI18n()
const say = usePhrase()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))

const projectId = ref<number | null>(null)
const subjectId = ref<number | null>(null)
const openedId = ref<number | null>(null)
const openedStep = ref<string | null>(null)
const announcement = ref('')
const newTitle = ref('')
const newSubject = ref<number | null>(null)
const newWorkflow = ref<number | null>(null)
const selfLogin = ref<string | null>(null)

const forge = useForgeBoard(() => projectId.value)
const starter = useProjectWorkflow(() => projectId.value ?? 0)
const workflowBarVersion = ref(0)

const project = computed(() => (projects.data.value ?? []).find((candidate) => candidate.id === projectId.value) ?? null)
const stepsByWorkflow = computed<ReadonlyMap<number, readonly BoardStep[]>>(
  () =>
    new Map(
      forge.workflows.value.map((workflow) => [
        workflow.id,
        boardSteps(forge.columnsOf(workflow.id), { backlog: t('forge.backlog'), done: t('forge.done') }),
      ]),
    ),
)
const visible = computed(() => filterBySubject(forge.cards.value, subjectId.value))
const addable = computed(() => holdableSubjects(forge.subjects.value, selfLogin.value))
const opened = computed(() => forge.cards.value.find((card) => card.id === openedId.value) ?? null)
const lanes = computed(() => lanesOf(forge.workflows.value, visible.value))
const noWorkflow = computed(
  () => forge.workflow.value !== null && forge.workflows.value.every((workflow) => forge.columnsOf(workflow.id).length === 0),
)
const openedSteps = computed(() => (opened.value === null ? [] : stepsOf(opened.value)))
const projectName = computed(() => project.value?.name ?? '')

function chooseProject(id: number): void {
  projectId.value = id
  writePreference(FORGE_PROJECT_KEY, String(id))
}

function stepsOf(card: ForgeCardView): readonly BoardStep[] {
  return stepsByWorkflow.value.get(card.workflowId) ?? []
}

function stepLabel(card: ForgeCardView, key: string): string {
  return stepsOf(card).find((step) => step.key === key)?.label ?? key
}

function open(card: ForgeCardView, stepKey: string): void {
  openedId.value = card.id
  openedStep.value = stepKey
}

function closeDrawer(): void {
  openedId.value = null
  openedStep.value = null
}

async function move(card: ForgeCardView, stepKey: string): Promise<void> {
  const moved = await forge.move(card, stepKey)
  if (moved !== null) {
    announcement.value = t(moved.started ? 'forge.movedAndStarted' : 'forge.movedTo', {
      title: card.title,
      step: stepLabel(card, stepKey),
    })
  }
}

async function act(card: ForgeCardView, action: CardAction): Promise<void> {
  if (action === 'stop') {
    await forge.stop(card)
    return
  }
  if (action === 'validate') {
    const steps = stepsOf(card)
    const index = steps.findIndex((step) => step.key === card.stepKey)
    const next = steps[index + 1]
    if (next !== undefined && next.kind === 'step') {
      await move(card, next.key)
      return
    }
    if (isLastStep(steps, card) && (await forge.finish(card))) {
      announcement.value = t('forge.finished', { title: card.title })
    }
    return
  }
  if (card.stepKey === 'backlog') {
    const first = firstStepKey(stepsOf(card))
    if (first !== null) {
      await move(card, first)
    }
    return
  }
  const launched = await forge.launch(card)
  if (launched !== null) {
    announcement.value = t('forge.movedAndStarted', { title: card.title, step: stepLabel(card, card.stepKey) })
  }
}

async function addStory(): Promise<void> {
  const title = newTitle.value.trim()
  const subject = newSubject.value
  if (title === '' || subject === null) {
    return
  }
  const workflow = forge.workflows.value.length > 1 ? (newWorkflow.value ?? undefined) : undefined
  if (await forge.addStory(subject, title, workflow)) {
    newTitle.value = ''
  }
}

async function createStarter(): Promise<void> {
  const created = await starter.createMany(
    starterSteps((template) => t(templateLabelKey(template))),
  )
  if (created) {
    await forge.load()
    workflowBarVersion.value += 1
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
  closeDrawer()
  void forge.load().then(() => {
    newSubject.value = addable.value[0]?.id ?? null
    newWorkflow.value = forge.workflows.value[0]?.id ?? null
  })
})

onMounted(async () => {
  void readSelf()
  await projects.reload()
  const list = projects.data.value ?? []
  projectId.value = activeProjectOf(list, readPreference(FORGE_PROJECT_KEY, list.map((entry) => String(entry.id)), ''))
})
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col overflow-x-hidden overflow-y-auto" data-test="forge-screen">
    <p
      v-if="projectId === null && !projects.pending.value"
      class="m-0 px-4 py-6 text-sm text-txt-mid"
      data-test="forge-no-project"
    >
      {{ t('forge.noProject') }}
    </p>

    <template v-if="projectId !== null">
      <div class="flex min-w-0 flex-none flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <h2 class="sr-only">{{ t('forge.title') }}</h2>
        <div class="flex min-w-0 flex-wrap gap-1" role="group" :aria-label="t('forge.projectsAria')">
          <button
            v-for="entry in projects.data.value ?? []"
            :key="entry.id"
            type="button"
            class="flex items-center gap-2 rounded-md border-0 px-2.5 py-1.5 text-sm"
            :class="entry.id === projectId ? 'bg-elev text-txt-hi' : 'bg-transparent text-txt-mid hover:bg-elev'"
            :aria-pressed="entry.id === projectId"
            @click="chooseProject(entry.id)"
          >
            <span class="h-2 w-2 rounded-full" :style="{ background: tintOf(entry.colour) }" aria-hidden="true" />
            {{ entry.name }}
          </button>
        </div>
        <select
          v-model="subjectId"
          class="field max-w-full"
          :aria-label="t('forge.subjectFilter')"
        >
          <option :value="null">{{ t('forge.allSubjects') }}</option>
          <option v-for="subject in forge.subjects.value" :key="subject.id" :value="subject.id">
            {{ subject.title }}
          </option>
        </select>
        <div class="ml-auto flex items-center gap-3">
          <WorkflowBar :key="`${projectId}-${workflowBarVersion}`" :project-id="projectId" :project-name="projectName" @changed="forge.load()" />
        </div>
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
          class="field min-w-[12rem] flex-1"
          :placeholder="t('forge.addStory')"
          :aria-label="t('forge.addStoryTitle')"
        />
        <select
          v-model="newSubject"
          class="field max-w-full"
          :aria-label="t('forge.addStorySubject')"
        >
          <option v-for="subject in addable" :key="subject.id" :value="subject.id">
            {{ subject.title }}
          </option>
        </select>
        <select
          v-if="forge.workflows.value.length > 1"
          v-model="newWorkflow"
          class="field max-w-full"
          :aria-label="t('forge.addStoryWorkflow')"
          data-test="forge-new-workflow"
        >
          <option v-for="workflow in forge.workflows.value" :key="workflow.id" :value="workflow.id">
            {{ workflow.name }}
          </option>
        </select>
        <button
          type="submit"
          class="btn btn-primary btn-sm hover:opacity-90"
          :disabled="newTitle.trim() === ''"
        >
          {{ t('forge.addStoryButton') }}
        </button>
      </form>
      <p v-else-if="forge.workflow.value !== null" class="m-0 px-4 pb-3 text-xs text-txt-low">
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

      <p v-if="forge.pending.value" class="m-0 px-4 text-xs text-txt-low">{{ t('forge.loading') }}</p>

      <div class="min-h-[26rem] min-w-0 flex-1 px-4 pb-4" data-tour="forge-steps">
        <ForgeFlow
          :lanes="lanes"
          :steps-by-workflow="stepsByWorkflow"
          :busy="forge.busy.value"
          @open="open"
          @act="act"
        />
      </div>
    </template>

    <ForgeDrawer
      v-if="opened !== null"
      :key="opened.id"
      :card="opened"
      :step-key="openedStep ?? opened.stepKey"
      :steps="openedSteps"
      :project-name="projectName"
      :busy="forge.busy.value.has(opened.id)"
      @close="closeDrawer"
      @act="(action) => act(opened!, action)"
      @move="(key) => move(opened!, key)"
      @settled="forge.refresh()"
    />
  </div>
</template>
