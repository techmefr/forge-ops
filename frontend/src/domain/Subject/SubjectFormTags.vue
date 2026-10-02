<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Tag } from '@contract/EpicContract'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { tintOf } from '@/technical/Ui/Tint'
import { toggled } from './SubjectFormRule'

const LABEL_LIMIT = 40
const DEFAULT_COLOUR = '#0f9d8a'

const props = defineProps<{ tags: readonly Tag[]; modelValue: readonly number[] }>()
const emit = defineEmits<{ 'update:modelValue': [ids: readonly number[]]; created: [tag: Tag] }>()

const { t } = useI18n()
const say = usePhrase()

const label = ref('')
const colour = ref(DEFAULT_COLOUR)
const problem = ref<string | null>(null)
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

const picked = computed(() => new Set(props.modelValue))

function flip(tag: Tag): void {
  emit('update:modelValue', toggled(props.modelValue, tag.id))
}

async function add(): Promise<void> {
  problem.value = null
  refusal.value = null
  const wanted = label.value.trim().replace(/^#/, '')
  if (wanted === '') {
    problem.value = 'subjects.form.errors.tagLabelRequired'
    return
  }
  const existing = props.tags.find((tag) => tag.label.toLowerCase() === wanted.toLowerCase())
  if (existing !== undefined) {
    if (!picked.value.has(existing.id)) {
      emit('update:modelValue', [...props.modelValue, existing.id])
    }
    label.value = ''
    return
  }
  busy.value = true
  try {
    const tag = await board.send<Tag>('/api/tags', 'POST', { label: wanted, colour: colour.value })
    emit('created', tag)
    emit('update:modelValue', [...props.modelValue, tag.id])
    label.value = ''
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2">
    <legend class="text-sm text-txt-mid">
      {{ t('subjects.form.tags') }}
      <span class="text-xs text-txt-low">{{ t('subjects.form.tagsHint') }}</span>
    </legend>
    <div class="flex flex-wrap gap-1.5" data-test-id="form-tags">
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-txt-hi"
        :class="picked.has(tag.id) ? 'bg-elev' : 'hover:bg-elev/60'"
        :aria-pressed="picked.has(tag.id)"
        :data-test-id="`form-tag-${tag.id}`"
        @click="flip(tag)"
      >
        <span class="size-2 flex-none rounded-full" :style="{ background: tintOf(tag.colour) }" aria-hidden="true" />
        #{{ tag.label }}
        <span v-if="picked.has(tag.id)" aria-hidden="true">×</span>
      </button>
      <p v-if="tags.length === 0" class="text-xs text-txt-low">{{ t('subjects.form.tagsNone') }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <input
        v-model="label"
        type="text"
        :maxlength="LABEL_LIMIT"
        autocomplete="off"
        class="field min-w-40 flex-1"
        :class="problem === null ? 'border-line' : 'border-red'"
        :placeholder="t('subjects.form.tagNew')"
        :aria-label="t('subjects.form.tagNew')"
        :aria-invalid="problem !== null"
        aria-describedby="form-tag-problem"
        data-test-id="form-tag-label"
        @keydown.enter.prevent="add"
      />
      <input
        v-model="colour"
        type="color"
        class="h-8 w-10 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
        :aria-label="t('subjects.form.tagColour')"
        data-test-id="form-tag-colour"
      />
      <button
        type="button"
        :disabled="busy"
        class="btn btn-ghost btn-sm"
        data-test-id="form-tag-add"
        @click="add"
      >
        {{ t('subjects.form.tagAdd') }}
      </button>
    </div>
    <p id="form-tag-problem" class="text-xs text-red" role="alert" data-test-id="form-tag-problem">
      <template v-if="problem !== null">{{ t(problem) }}</template>
      <template v-else-if="refusal !== null">{{ say(refusal) }}</template>
    </p>
  </fieldset>
</template>
