<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { MAX_STEP_RETRIES } from '@contract/AutopilotContract'
import {
  CLAUDE_MODELS,
  PROMPT_TEMPLATES,
  PROMPT_TEMPLATE_KEYS,
  WORKFLOW_EFFORTS,
  WORKFLOW_PROVIDERS,
  type PromptTemplateKey,
  type WorkflowColumn,
  type WorkflowColumnDraft,
  type WorkflowProvider,
} from '@contract/WorkflowColumnContract'
import {
  colourInputValue,
  draftOf,
  isDirty,
  providerLabelKey,
  templateLabelKey,
  templateOfPrompt,
  withProvider,
} from './WorkflowRule'

const props = defineProps<{
  column: WorkflowColumn
  index: number
  total: number
  busy: boolean
}>()

const emit = defineEmits<{
  save: [draft: WorkflowColumnDraft]
  remove: []
  move: [direction: -1 | 1]
}>()

const { t } = useI18n()

const draft = ref<WorkflowColumnDraft>(draftOf(props.column))
const identifier = computed(() => `workflow-step-${props.column.id}`)
const dirty = computed(() => isDirty(draftOf(props.column), draft.value))
const isHuman = computed(() => draft.value.provider === 'human')
const isClaude = computed(() => draft.value.provider === 'claude')
const template = computed(() => templateOfPrompt(draft.value.preprompt))
const swatch = computed(() => colourInputValue(draft.value.colour))

watch(
  () => props.column,
  (column) => {
    draft.value = draftOf(column)
  },
)

function pickColour(event: Event): void {
  draft.value = { ...draft.value, colour: (event.target as HTMLInputElement).value }
}

function pickProvider(event: Event): void {
  draft.value = withProvider(draft.value, (event.target as HTMLSelectElement).value as WorkflowProvider)
}

function pickTemplate(event: Event): void {
  const key = (event.target as HTMLSelectElement).value as PromptTemplateKey | ''
  if (key !== '') {
    draft.value = { ...draft.value, preprompt: PROMPT_TEMPLATES[key] }
  }
}

function pickEffort(event: Event): void {
  draft.value = { ...draft.value, effort: (event.target as HTMLSelectElement).value as WorkflowColumnDraft['effort'] }
}
</script>

<template>
  <li class="flex flex-col gap-3 py-4" :aria-labelledby="`${identifier}-name`">
    <div class="flex items-center gap-1.5">
      <label class="flex items-center">
        <span class="sr-only">{{ t('workflowSettings.stepColour', { name: column.label }) }}</span>
        <input
          type="color"
          :value="swatch"
          class="h-7 w-7 rounded-md border border-line bg-transparent p-0.5 max-sm:h-10 max-sm:w-10"
          @input="pickColour"
        />
      </label>
      <label :for="`${identifier}-name`" class="sr-only">{{ t('workflowSettings.stepName') }}</label>
      <input
        :id="`${identifier}-name`"
        v-model="draft.label"
        type="text"
        maxlength="60"
        class="min-w-0 flex-1 rounded-md border border-line bg-card px-2.5 py-1.5 text-sm font-semibold text-txt-hi"
      />
      <button
        type="button"
        :disabled="index === 0 || busy"
        :aria-label="t('workflowSettings.moveUp', { name: column.label })"
        class="rounded-md px-2 py-1.5 text-txt-mid hover:bg-elev disabled:opacity-40 max-sm:h-10 max-sm:min-w-10"
        @click="emit('move', -1)"
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        :disabled="index === total - 1 || busy"
        :aria-label="t('workflowSettings.moveDown', { name: column.label })"
        class="rounded-md px-2 py-1.5 text-txt-mid hover:bg-elev disabled:opacity-40 max-sm:h-10 max-sm:min-w-10"
        @click="emit('move', 1)"
      >
        <span aria-hidden="true">↓</span>
      </button>
      <button
        type="button"
        :disabled="busy"
        :aria-label="t('workflowSettings.remove', { name: column.label })"
        class="rounded-md px-2 py-1.5 text-txt-mid hover:bg-elev disabled:opacity-40 max-sm:h-10 max-sm:min-w-10"
        @click="emit('remove')"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-x-3 gap-y-2.5 min-[760px]:grid-cols-2">
      <label class="flex flex-col gap-1 text-xs text-txt-low">
        {{ t('workflowSettings.provider') }}
        <select
          :value="draft.provider"
          class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
          @change="pickProvider"
        >
          <option v-for="provider in WORKFLOW_PROVIDERS" :key="provider" :value="provider">
            {{ t(providerLabelKey(provider)) }}
          </option>
        </select>
      </label>

      <p v-if="isHuman" class="m-0 self-end pb-1.5 text-sm text-txt-mid">
        {{ t('workflowSettings.humanNote') }}
      </p>

      <template v-else>
        <label class="flex flex-col gap-1 text-xs text-txt-low">
          {{ t('workflowSettings.model') }}
          <select
            v-if="isClaude"
            v-model="draft.model"
            class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
          >
            <option v-for="model in CLAUDE_MODELS" :key="model" :value="model">{{ model }}</option>
          </select>
          <select
            v-else
            disabled
            class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi opacity-70"
          >
            <option value="">{{ t('workflowSettings.modelCli') }}</option>
          </select>
        </label>

        <label class="flex flex-col gap-1 text-xs text-txt-low">
          {{ t('workflowSettings.effort') }}
          <select
            :value="draft.effort"
            class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
            @change="pickEffort"
          >
            <option v-for="effort in WORKFLOW_EFFORTS" :key="effort" :value="effort">{{ effort }}</option>
          </select>
        </label>

        <label v-if="isClaude" class="flex flex-col gap-1 text-xs text-txt-low">
          {{ t('workflowSettings.agent') }}
          <input
            v-model="draft.agentName"
            type="text"
            :placeholder="t('workflowSettings.mainSession')"
            class="rounded-md border border-line bg-card px-2.5 py-1.5 font-mono text-sm text-txt-hi"
          />
        </label>

        <label class="flex flex-col gap-1 text-xs text-txt-low" :class="isClaude ? '' : 'min-[760px]:col-span-2'">
          {{ isClaude ? t('workflowSettings.skill') : t('workflowSettings.command') }}
          <input
            v-model="draft.command"
            type="text"
            :placeholder="isClaude ? t('workflowSettings.skillPlaceholder') : t('workflowSettings.commandPlaceholder')"
            class="rounded-md border border-line bg-card px-2.5 py-1.5 font-mono text-sm text-txt-hi"
          />
        </label>

        <label class="flex flex-col gap-1 text-xs text-txt-low min-[760px]:col-span-2">
          {{ t('workflowSettings.basePrompt') }}
          <select
            :value="template"
            class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
            @change="pickTemplate"
          >
            <option value="">{{ t('workflowSettings.pickTemplate') }}</option>
            <option v-for="key in PROMPT_TEMPLATE_KEYS" :key="key" :value="key">
              {{ t(templateLabelKey(key)) }}
            </option>
          </select>
        </label>

        <div class="flex flex-col gap-1 min-[760px]:col-span-2">
          <label :for="`${identifier}-prompt`" class="sr-only">
            {{ t('workflowSettings.promptText', { name: column.label }) }}
          </label>
          <textarea
            :id="`${identifier}-prompt`"
            v-model="draft.preprompt"
            rows="4"
            :aria-describedby="`${identifier}-hint`"
            class="rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
          />
          <small :id="`${identifier}-hint`" class="text-xs text-txt-low">
            {{ t('workflowSettings.promptHint') }}
          </small>
        </div>

        <label class="flex items-center gap-2 text-sm text-txt-mid min-[760px]:col-span-2">
          <input v-model="draft.autoStart" type="checkbox" class="h-4 w-4 accent-[var(--forge-acc)]" />
          {{ t('workflowSettings.autoStart') }}
        </label>

        <label class="flex flex-col gap-1 text-xs text-txt-low min-[760px]:col-span-2">
          {{ t('autopilot.retries') }}
          <input
            v-model.number="draft.maxRetries"
            type="number"
            min="0"
            :max="MAX_STEP_RETRIES"
            :aria-describedby="`${identifier}-retries`"
            class="w-24 rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
          />
          <small :id="`${identifier}-retries`" class="text-xs text-txt-low">{{ t('autopilot.retriesHint') }}</small>
        </label>
      </template>
    </div>

    <div class="flex items-center gap-3">
      <button
        type="button"
        :disabled="!dirty || busy"
        class="rounded-md border border-line px-3 py-1.5 text-xs text-txt-hi hover:bg-elev disabled:opacity-40"
        @click="emit('save', draft)"
      >
        {{ t('workflowSettings.save') }}
      </button>
      <span v-if="dirty" class="text-xs text-txt-low">{{ t('workflowSettings.unsaved') }}</span>
    </div>
  </li>
</template>
