<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import { dependencyCandidates } from './SubjectFormRule'

const props = defineProps<{
  subjects: readonly EpicOverview[]
  projects: readonly Project[]
  selfId: number | null
  modelValue: readonly number[]
}>()
const emit = defineEmits<{ 'update:modelValue': [ids: readonly number[]] }>()

const { t } = useI18n()

const chosen = ref('')

const candidates = computed(() => dependencyCandidates(props.subjects, props.selfId, props.modelValue))
const picked = computed(() =>
  props.modelValue.map((id) => ({ id, title: props.subjects.find((subject) => subject.id === id)?.title ?? `#${id}` })),
)

function projectName(subject: EpicOverview): string {
  return props.projects.find((project) => project.id === subject.projectId)?.name ?? ''
}

function add(): void {
  const id = Number(chosen.value)
  if (id > 0 && !props.modelValue.includes(id)) {
    emit('update:modelValue', [...props.modelValue, id])
  }
  chosen.value = ''
}

function remove(id: number): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((entry) => entry !== id),
  )
}
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2">
    <legend class="text-sm text-txt-mid">
      {{ t('subjects.form.dependsOn') }}
      <span class="text-xs text-txt-low">{{ t('subjects.form.dependsOnHint') }}</span>
    </legend>
    <ul class="flex flex-wrap gap-1.5" data-test-id="form-dependencies">
      <li
        v-for="entry in picked"
        :key="entry.id"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-txt-hi"
      >
        {{ entry.title }}
        <button
          type="button"
          class="text-txt-mid hover:text-txt-hi"
          :aria-label="t('subjects.form.dependsRemove', { title: entry.title })"
          @click="remove(entry.id)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </li>
      <li v-if="picked.length === 0" class="text-xs text-txt-low">{{ t('subjects.form.dependsNone') }}</li>
    </ul>
    <div class="flex flex-wrap items-center gap-2">
      <select
        v-model="chosen"
        class="min-w-40 flex-1 rounded-md border border-line bg-transparent px-2.5 py-1.5 text-sm text-txt-hi"
        :aria-label="t('subjects.form.dependsPick')"
        data-test-id="form-dependency-select"
      >
        <option value="">{{ t('subjects.form.dependsChoose') }}</option>
        <option v-for="candidate in candidates" :key="candidate.id" :value="String(candidate.id)">
          {{ projectName(candidate) }} · {{ candidate.title }}
        </option>
      </select>
      <button
        type="button"
        :disabled="chosen === ''"
        class="rounded-md px-3 py-1.5 text-xs font-semibold text-txt-mid hover:bg-elev disabled:opacity-40"
        data-test-id="form-dependency-add"
        @click="add"
      >
        {{ t('subjects.form.dependsAdd') }}
      </button>
    </div>
  </fieldset>
</template>
