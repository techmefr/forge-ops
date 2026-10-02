<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SubjectLink } from '@contract/EpicContract'
import type { BoardUserSheet, ProjectSheet, ProjectUpdate } from '@contract/ProjectContract'
import ProjectLinks from './ProjectLinks.vue'
import WorkflowBar from '@/domain/Workflow/WorkflowBar.vue'
import { mayChangeAdmin, usedBy, type TeamSelf } from './TeamRule'
import { usePhrase } from '@/technical/Language/UsePhrase'

const props = defineProps<{
  sheet: ProjectSheet
  index: number
  total: number
  users: readonly BoardUserSheet[]
  self: TeamSelf | null
}>()

const emit = defineEmits<{
  change: [patch: ProjectUpdate]
  move: [direction: -1 | 1]
  remove: []
}>()

const { t } = useI18n()
const say = usePhrase()

const reason = computed(() => usedBy(props.sheet.usage))
const adminLocked = computed(() => !mayChangeAdmin(props.sheet, props.self))
const candidates = computed(() =>
  props.users.filter((user) => user.active || user.id === props.sheet.adminUserId),
)

function pickAdmin(event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  emit('change', { adminId: value === '' ? null : Number(value) })
}

function pickColour(event: Event): void {
  emit('change', { colour: (event.target as HTMLInputElement).value })
}

function relink(links: readonly SubjectLink[]): void {
  emit('change', { links: [...links] })
}
</script>

<template>
  <li class="flex flex-col gap-3 rounded-md bg-panel px-3 py-3">
    <div class="flex flex-wrap items-center gap-3">
      <label class="flex items-center">
        <span class="sr-only">{{ t('team.colourOf', { name: sheet.name }) }}</span>
        <input
          type="color"
          :value="sheet.colour"
          class="h-8 w-9 max-sm:h-10 max-sm:w-10 rounded-md border border-line bg-transparent p-0.5"
          @change="pickColour"
        />
      </label>

      <div class="min-w-[9rem] flex-1">
        <strong class="text-sm text-txt-hi">{{ sheet.name }}</strong>
        <p
          :id="`project-use-${sheet.id}`"
          class="m-0 text-xs"
          :class="reason === null ? 'text-txt-low' : 'text-orange'"
        >
          {{ reason === null ? t('team.unused') : say(reason) }}
        </p>
      </div>

      <label class="flex items-center gap-2 text-xs text-txt-low">
        {{ t('team.admin') }}
        <select
          :value="sheet.adminUserId ?? ''"
          :disabled="adminLocked"
          :aria-describedby="adminLocked ? `project-admin-lock-${sheet.id}` : undefined"
          class="rounded-md border border-line bg-card px-2 py-1.5 text-sm text-txt-hi disabled:opacity-60"
          @change="pickAdmin"
        >
          <option value="">{{ t('team.noAdmin') }}</option>
          <option v-for="user in candidates" :key="user.id" :value="user.id">
            {{ user.displayName }}{{ user.active ? '' : ` (${t('team.inactive')})` }}
          </option>
        </select>
      </label>

      <WorkflowBar :project-id="sheet.id" :project-name="sheet.name" />

      <div class="flex items-center gap-1">
        <button
          type="button"
          :disabled="index === 0"
          :aria-label="t('team.moveUp', { name: sheet.name })"
          class="rounded-md px-2 py-1 max-sm:min-h-10 max-sm:min-w-10 text-txt-mid hover:bg-elev disabled:opacity-40"
          @click="emit('move', -1)"
        >
          <span aria-hidden="true">↑</span>
        </button>
        <button
          type="button"
          :disabled="index === total - 1"
          :aria-label="t('team.moveDown', { name: sheet.name })"
          class="rounded-md px-2 py-1 max-sm:min-h-10 max-sm:min-w-10 text-txt-mid hover:bg-elev disabled:opacity-40"
          @click="emit('move', 1)"
        >
          <span aria-hidden="true">↓</span>
        </button>
        <button
          type="button"
          :disabled="reason !== null"
          :aria-describedby="`project-use-${sheet.id}`"
          class="rounded-md px-2.5 py-1 text-xs text-txt-mid hover:bg-elev disabled:opacity-40"
          @click="emit('remove')"
        >
          {{ t('team.delete') }}<span class="sr-only"> {{ sheet.name }}</span>
        </button>
      </div>
    </div>

    <p v-if="adminLocked" :id="`project-admin-lock-${sheet.id}`" class="m-0 text-xs text-txt-low">
      {{ t('team.adminLocked') }}
    </p>

    <ProjectLinks :name="sheet.name" :links="sheet.links" :identifier="sheet.id" @update="relink" />
  </li>
</template>
