<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
const accent = computed(() => colourInputValue(draft.value.colour))

watch(
  () => props.column,
  (column) => {
    draft.value = draftOf(column)
  },
)

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
  <li
    class="flex flex-col gap-3 rounded-lg border border-line border-l-4 bg-card p-3"
    :style="{ borderLeftColor: accent }"
    :aria-labelledby="`${identifier}-name`"
  >
    <div class="flex flex-wrap items-center gap-2">
      <label class="flex items-center">
        <span class="sr-only">{{ t('workflowSettings.stepColour', { name: column.label }) }}</span>
        <input
          type="color"
          :value="accent"
          class="h-8 w-9 rounded-md border border-line bg-transparent p-0.5"
          @input="draft.colour = ($event.target as HTMLInputElement).value"
        />
      </label>
      <label :for="`${identifier}-name`" class="sr-only">{{ t('workflowSettings.stepName') }}</label>
      <input
        :id="`${identifier}-name`"
        v-model="draft.label"
        type="text"
        maxlength="60"
        class="min-w-[8rem] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm font-semibold text-txt-hi"
      />
      <button
        type="button"
        :disabled="index === 0 || busy"
        :aria-label="t('workflowSettings.moveUp', { name: column.label })"
        class="rounded-lg border border-line px-2.5 py-1.5 text-txt-mid hover:border-acc disabled:opacity-40"
        @click="emit('move', -1)"
      >
        <span aria-hidden="true">↑</span>
      </button>
      <button
        type="button"
        :disabled="index === total - 1 || busy"
        :aria-label="t('workflowSettings.moveDown', { name: column.label })"
        class="rounded-lg border border-line px-2.5 py-1.5 text-txt-mid hover:border-acc disabled:opacity-40"
        @click="emit('move', 1)"
      >
        <span aria-hidden="true">↓</span>
      </button>
      <button
        type="button"
        :disabled="busy"
        :aria-label="t('workflowSettings.remove', { name: column.label })"
        class="rounded-lg border border-line px-2.5 py-1.5 text-txt-mid hover:border-red disabled:opacity-40"
        @click="emit('remove')"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>

    <div class="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2">
      <label class="flex flex-col gap-1 text-[11px] tracking-[0.12em] text-txt-low uppercase">
        {{ t('workflowSettings.provider') }}
        <select
          :value="draft.provider"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm tracking-normal text-txt-hi normal-case"
          @change="pickProvider"
        >
          <option v-for="provider in WORKFLOW_PROVIDERS" :key="provider" :value="provider">
            {{ t(providerLabelKey(provider)) }}
          </option>
        </select>
      </label>

      <p
        v-if="isHuman"
        class="m-0 self-end text-[13px] text-txt-mid min-[760px]:col-span-1"
      >
        {{ t('workflowSettings.humanNote') }}
      </p>

      <template v-else>
        <label class="flex flex-col gap-1 text-[11px] tracking-[0.12em] text-txt-low uppercase">
          {{ t('workflowSettings.model') }}
          <select
            v-if="isClaude"
            v-model="draft.model"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm tracking-normal text-txt-hi normal-case"
          >
            <option v-for="model in CLAUDE_MODELS" :key="model" :value="model">{{ model }}</option>
          </select>
          <select
            v-else
            disabled
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm tracking-normal text-txt-hi normal-case opacity-70"
          >
            <option value="">{{ t('workflowSettings.modelCli') }}</option>
          </select>
        </label>

        <label class="flex flex-col gap-1 text-[11px] tracking-[0.12em] text-txt-low uppercase">
          {{ t('workflowSettings.effort') }}
          <select
            :value="draft.effort"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm tracking-normal text-txt-hi normal-case"
            @change="pickEffort"
          >
            <option v-for="effort in WORKFLOW_EFFORTS" :key="effort" :value="effort">{{ effort }}</option>
          </select>
        </label>

        <label
          v-if="isClaude"
          class="flex flex-col gap-1 text-[11px] tracking-[0.12em] text-txt-low uppercase"
        >
          {{ t('workflowSettings.agent') }}
          <input
            v-model="draft.agentName"
            type="text"
            :placeholder="t('workflowSettings.mainSession')"
            class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-[13px] tracking-normal text-txt-hi normal-case"
          />
        </label>

        <label
          class="flex flex-col gap-1 text-[11px] tracking-[0.12em] text-txt-low uppercase"
          :class="isClaude ? 'min-[760px]:col-span-2' : ''"
        >
          {{ isClaude ? t('workflowSettings.skill') : t('workflowSettings.command') }}
          <input
            v-model="draft.command"
            type="text"
            :placeholder="isClaude ? t('workflowSettings.skillPlaceholder') : t('workflowSettings.commandPlaceholder')"
            class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-[13px] tracking-normal text-txt-hi normal-case"
          />
        </label>

        <label class="flex flex-col gap-1 text-[11px] tracking-[0.12em] text-txt-low uppercase min-[760px]:col-span-2">
          {{ t('workflowSettings.basePrompt') }}
          <select
            :value="template"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm tracking-normal text-txt-hi normal-case"
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
            class="rounded-lg border border-line bg-elev px-3 py-2 text-[13px] text-txt-hi"
          />
          <small :id="`${identifier}-hint`" class="text-[11px] text-txt-low">
            {{ t('workflowSettings.promptHint') }}
          </small>
        </div>

        <label class="flex items-center gap-2 text-[13px] text-txt-mid min-[760px]:col-span-2">
          <input v-model="draft.autoStart" type="checkbox" class="h-4 w-4 accent-[var(--forge-acc)]" />
          {{ t('workflowSettings.autoStart') }}
        </label>
      </template>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="!dirty || busy"
        class="rounded-lg border border-acc bg-acc px-3 py-1.5 font-mono text-[11px] font-bold text-ink uppercase disabled:opacity-40"
        @click="emit('save', draft)"
      >
        {{ t('workflowSettings.save') }}
      </button>
      <span v-if="dirty" class="text-[11px] text-orange">{{ t('workflowSettings.unsaved') }}</span>
    </div>
  </li>
</template>
