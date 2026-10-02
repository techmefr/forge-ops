<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { PromptTemplateKey, WorkflowColumnDraft } from '@contract/WorkflowColumnContract'
import { usePhrase } from '@/technical/Language/UsePhrase'
import RequiredStar from '@/technical/Ui/RequiredStar.vue'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useAlertFocus } from '@/technical/Ui/FieldState'
import { useProjectWorkflow } from './UseProjectWorkflow'
import { keysAfterMove, newStep, starterSteps, templateLabelKey } from './WorkflowRule'
import WorkflowEmptyState from './WorkflowEmptyState.vue'
import WorkflowStepCard from './WorkflowStepCard.vue'
import AutopilotSection from './AutopilotSection.vue'

const props = defineProps<{ projectId: number; projectName: string }>()

const emit = defineEmits<{ close: []; changed: [] }>()

const { t } = useI18n()
const say = usePhrase()

const state = useProjectWorkflow(() => props.projectId)
const newName = ref('')
const drawerEl = ref<HTMLElement | null>(null)
useAlertFocus(state.failure, drawerEl)

const columns = computed(() => state.workflow.value?.columns ?? [])
const maySettle = computed(() => state.workflow.value?.maySettle ?? false)
const admin = computed(() => state.workflow.value?.admin ?? null)

function announce(succeeded: boolean): void {
  if (succeeded) {
    emit('changed')
  }
}

async function createStarter(): Promise<void> {
  announce(
    await state.createMany(
      starterSteps((template: PromptTemplateKey) => t(templateLabelKey(template))),
    ),
  )
}

async function addStep(): Promise<void> {
  const label = newName.value.trim()
  if (label === '') {
    return
  }
  const created = await state.create(newStep(label))
  if (created) {
    newName.value = ''
  }
  announce(created)
}

async function save(columnId: number, draft: WorkflowColumnDraft): Promise<void> {
  announce(await state.update(columnId, draft))
}

async function remove(columnId: number): Promise<void> {
  announce(await state.remove(columnId))
}

async function move(key: string, direction: -1 | 1): Promise<void> {
  const keys = keysAfterMove(
    columns.value.map((column) => column.key),
    key,
    direction,
  )
  if (keys !== null) {
    announce(await state.reorder(keys))
  }
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    emit('close')
  }
}

onMounted(() => void state.load())
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col gap-3 overflow-y-auto border-l border-line bg-panel px-6 py-4 min-[760px]:w-[min(560px,100vw)]"
        ref="drawerEl"
        data-test="workflow-drawer"
      >
        <div class="flex items-start gap-3">
          <DialogTitle class="title-face m-0 flex-1 text-[22px] text-txt-hi uppercase">
            {{ t('workflowSettings.title', { name: projectName }) }}
          </DialogTitle>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 font-mono text-[11px] text-txt-mid uppercase hover:bg-elev"
            @click="emit('close')"
          >
            {{ t('workflowSettings.close') }}
          </button>
        </div>
        <DialogDescription class="m-0 text-sm text-txt-mid">
          {{ t('workflowSettings.intro', { name: projectName }) }}
        </DialogDescription>

        <p v-if="state.pending.value" class="m-0 font-mono text-xs tracking-[0.2em] text-txt-low uppercase">
          {{ t('common.loading') }}
        </p>
        <p v-if="state.failure.value !== null" id="workflow-failure" class="m-0 text-sm text-red" role="alert" tabindex="-1">
          {{ say(state.failure.value) }}
        </p>

        <template v-if="state.workflow.value !== null">
          <p class="m-0 border-b border-line pb-2 font-mono text-[11px] text-txt-low">
            {{ t('workflowSettings.backlogFixed') }}
          </p>

          <AutopilotSection :project-id="projectId" />

          <WorkflowEmptyState
            v-if="columns.length === 0"
            :project-name="projectName"
            :admin="admin"
            :may-settle="maySettle"
            :busy="state.busy.value"
            @create="createStarter"
          />

          <ol
            v-else
            class="m-0 flex list-none flex-col divide-y divide-line p-0"
            :aria-label="t('workflowSettings.stepsOf', { name: projectName })"
          >
            <WorkflowStepCard
              v-for="(column, index) in columns"
              :key="column.id"
              :column="column"
              :index="index"
              :total="columns.length"
              :busy="state.busy.value"
              @save="(draft) => save(column.id, draft)"
              @remove="remove(column.id)"
              @move="(direction) => move(column.key, direction)"
            />
          </ol>

          <form
            v-if="maySettle"
            class="flex flex-wrap items-end gap-2"
            @submit.prevent="addStep"
          >
            <label class="flex min-w-[10rem] flex-1 flex-col gap-1 text-[11px] text-txt-low">
              <span>{{ t('workflowSettings.newStepName') }} <RequiredStar /></span>
              <input
                v-model="newName"
                v-bind="requiredField(state.failure.value, 'workflow-failure')"
                type="text"
                maxlength="60"
                class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
              />
            </label>
            <button
              type="submit"
              :disabled="state.busy.value || newName.trim() === ''"
              class="rounded-md border border-line px-3 py-1.5 font-mono text-[11px] text-txt-hi uppercase hover:bg-elev disabled:opacity-40"
            >
              {{ t('workflowSettings.addStep') }}
            </button>
            <RequiredNote class="basis-full" />
          </form>

          <p class="m-0 border-t border-line pt-2 font-mono text-[11px] text-txt-low">
            {{ t('workflowSettings.doneFixed') }}
          </p>
          <p class="m-0 text-[11px] text-txt-low">{{ t('workflowSettings.footnote') }}</p>
        </template>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
