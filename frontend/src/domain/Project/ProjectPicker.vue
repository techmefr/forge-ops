<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Project } from '@/domain/Board/BoardModel'
import { tintOf } from '@/technical/Ui/Tint'
import NewProjectDialog from './NewProjectDialog.vue'
import { optionKey, optionsOf, stepIndex, type PickerOption } from './ProjectPickerRule'

const props = defineProps<{
  id: string
  projects: readonly Project[]
  modelValue: number | null
  allLabel?: string
  disabled?: boolean
  invalid?: boolean
  describedby?: string
  testId?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [projectId: number | null]
  created: [project: Project]
}>()

const { t } = useI18n()

const query = ref('')
const typing = ref(false)
const open = ref(false)
const active = ref(-1)
const creatingName = ref<string | null>(null)
const made = ref<readonly Project[]>([])
const input = ref<HTMLInputElement | null>(null)

const known = computed(() => [
  ...props.projects,
  ...made.value.filter((project) => !props.projects.some((entry) => entry.id === project.id)),
])
const selected = computed(() => known.value.find((project) => project.id === props.modelValue) ?? null)
const shownText = computed(() => {
  if (typing.value) {
    return query.value
  }
  if (selected.value !== null) {
    return selected.value.name
  }
  return props.modelValue === null ? (props.allLabel ?? '') : ''
})
const options = computed(() =>
  optionsOf({
    projects: known.value,
    query: typing.value ? query.value : '',
    showAll: props.allLabel !== undefined,
    creatable: true,
  }),
)
const listId = computed(() => `${props.id}-list`)
const activeId = computed(() => {
  const option = options.value[active.value]
  return open.value && option !== undefined ? optionId(option) : undefined
})

function optionId(option: PickerOption): string {
  return `${props.id}-option-${optionKey(option)}`
}

function isSelected(option: PickerOption): boolean {
  if (option.kind === 'all') {
    return props.modelValue === null
  }
  return option.kind === 'project' && option.project.id === props.modelValue
}

function startingIndex(): number {
  const index = options.value.findIndex(isSelected)
  return index >= 0 ? index : 0
}

function show(): void {
  if (props.disabled === true) {
    return
  }
  open.value = true
  active.value = options.value.length === 0 ? -1 : startingIndex()
}

function hide(): void {
  open.value = false
  active.value = -1
  typing.value = false
  query.value = ''
}

function typed(event: Event): void {
  typing.value = true
  query.value = (event.target as HTMLInputElement).value
  open.value = true
  active.value = options.value.length === 0 ? -1 : 0
}

function choose(option: PickerOption): void {
  if (option.kind === 'create') {
    creatingName.value = option.name
    hide()
    return
  }
  emit('update:modelValue', option.kind === 'all' ? null : option.project.id)
  hide()
}

function move(direction: 1 | -1): void {
  if (!open.value) {
    show()
    return
  }
  active.value = stepIndex(active.value, options.value.length, direction)
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    move(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Enter' && open.value) {
    event.preventDefault()
    const option = options.value[active.value]
    if (option === undefined) {
      hide()
      return
    }
    choose(option)
    return
  }
  if (event.key === 'Escape' && open.value) {
    event.preventDefault()
    event.stopPropagation()
    hide()
    return
  }
  if (event.key === 'Tab') {
    hide()
  }
}

function toggle(): void {
  if (open.value) {
    hide()
  } else {
    show()
  }
  input.value?.focus()
}

function projectMade(project: Project): void {
  made.value = [...made.value, project]
  creatingName.value = null
  emit('created', project)
  emit('update:modelValue', project.id)
  input.value?.focus()
}

function projectAbandoned(): void {
  creatingName.value = null
  input.value?.focus()
}

function createLabel(name: string): string {
  return t('projectPicker.create', { name })
}
</script>

<template>
  <div class="relative">
    <div class="flex items-stretch">
      <input
        :id="id"
        ref="input"
        type="text"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        :aria-expanded="open"
        :aria-controls="listId"
        :aria-activedescendant="activeId"
        :aria-invalid="invalid === true ? true : undefined"
        :aria-describedby="describedby"
        :disabled="disabled"
        :value="shownText"
        :placeholder="t('projectPicker.placeholder')"
        class="field min-w-0 flex-1 rounded-l-md disabled:opacity-60"
        :class="invalid === true ? 'border-red' : 'border-line'"
        :data-test-id="testId"
        @input="typed"
        @keydown="onKeydown"
        @focus="typing = false"
        @blur="hide"
      />
      <button
        type="button"
        tabindex="-1"
        :disabled="disabled"
        :aria-label="t('projectPicker.toggle')"
        class="btn btn-ghost -ml-px rounded-r-md disabled:opacity-60"
        @mousedown.prevent
        @click="toggle"
      >
        <span aria-hidden="true">{{ open ? '▴' : '▾' }}</span>
      </button>
    </div>

    <ul
      v-show="open && options.length > 0"
      :id="listId"
      role="listbox"
      :aria-label="t('projectPicker.list')"
      class="absolute inset-x-0 top-full z-[80] mt-1 max-h-56 overflow-y-auto rounded-md border border-line bg-elev py-1"
      data-test-id="project-picker-list"
      @mousedown.prevent
    >
      <li
        v-for="(option, index) in options"
        :id="optionId(option)"
        :key="optionKey(option)"
        role="option"
        :aria-selected="isSelected(option)"
        class="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-sm text-txt-hi"
        :class="[ index === active ? 'bg-line' : '', option.kind === 'create' ? 'border-t border-hair text-acc' : '', ]"
        :data-test-id="`project-option-${optionKey(option)}`"
        @mouseenter="active = index"
        @click="choose(option)"
      >
        <template v-if="option.kind === 'project'">
          <span
            class="size-2 flex-none rounded-full"
            :style="{ background: tintOf(option.project.colour) }"
            aria-hidden="true"
          />
          <span class="min-w-0 flex-1 truncate">{{ option.project.name }}</span>
        </template>
        <span v-else-if="option.kind === 'all'" class="min-w-0 flex-1 truncate">{{ allLabel }}</span>
        <span v-else class="min-w-0 flex-1 truncate">{{ createLabel(option.name) }}</span>
        <span v-if="isSelected(option)" class="flex-none text-xs text-txt-low" aria-hidden="true">✓</span>
      </li>
    </ul>
    <p v-if="open && options.length === 0" class="mt-1 text-xs text-txt-low" role="status">
      {{ t('projectPicker.empty') }}
    </p>

    <NewProjectDialog
      v-if="creatingName !== null"
      :name="creatingName"
      :count="known.length"
      @close="projectAbandoned"
      @created="projectMade"
    />
  </div>
</template>
