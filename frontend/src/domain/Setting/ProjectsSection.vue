<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BoardUserSheet, ProjectSheet, ProjectUpdate } from '@contract/ProjectContract'
import EffectBadge from './EffectBadge.vue'
import ProjectRow from './ProjectRow.vue'
import ProjectCreateForm from '@/domain/Board/ProjectCreateForm.vue'
import { positionAfterMove, type TeamSelf } from './TeamRule'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'

const props = defineProps<{ self: TeamSelf | null; workflowReachable: boolean }>()

const emit = defineEmits<{ workflow: [] }>()

const { t } = useI18n()
const say = usePhrase()

const sheets = useResource<readonly ProjectSheet[]>(() => board.read('/api/projects/sheets'))
const users = useResource<readonly BoardUserSheet[]>(() => board.read('/api/board-users'))
const refusal = ref<Phrase | null>(null)
const adding = ref(false)

const rows = computed(() => sheets.data.value ?? [])

async function guard(action: () => Promise<void>): Promise<void> {
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  }
  await sheets.reload()
}

function change(sheet: ProjectSheet, patch: ProjectUpdate): Promise<void> {
  return guard(async () => {
    await board.send(`/api/projects/${sheet.id}`, 'PUT', patch)
  })
}

function move(sheet: ProjectSheet, index: number, direction: -1 | 1): Promise<void> {
  const position = positionAfterMove(index, direction, rows.value.length)
  return position === null ? Promise.resolve() : change(sheet, { position })
}

function remove(sheet: ProjectSheet): Promise<void> {
  return guard(async () => {
    await board.send(`/api/projects/${sheet.id}`, 'DELETE', undefined)
  })
}

async function created(): Promise<void> {
  adding.value = false
  await sheets.reload()
}

void sheets.reload()
void users.reload()
</script>

<template>
  <section class="flex flex-col gap-4 rounded-lg border border-line bg-card p-4" data-tour="setting-projects">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-[22px]">{{ t('team.projects') }}</h2>
      <EffectBadge section="projects" />
    </div>
    <p class="m-0 text-[13px] text-txt-mid">{{ t('team.projectsSub') }}</p>

    <p v-if="refusal !== null" class="m-0 text-[13px] text-red" role="alert">{{ say(refusal) }}</p>
    <p v-if="sheets.failure.value !== null" class="m-0 text-[13px] text-red" role="alert">
      {{ say(sheets.failure.value) }}
    </p>

    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <ProjectRow
        v-for="(sheet, index) in rows"
        :key="sheet.id"
        :sheet="sheet"
        :index="index"
        :total="rows.length"
        :users="users.data.value ?? []"
        :self="props.self"
        :workflow-reachable="props.workflowReachable"
        @change="(patch) => change(sheet, patch)"
        @move="(direction) => move(sheet, index, direction)"
        @remove="remove(sheet)"
        @workflow="emit('workflow')"
      />
    </ul>

    <div>
      <button
        v-if="!adding"
        type="button"
        class="rounded-lg border border-line px-3 py-2 font-mono text-[11px] text-txt-mid uppercase hover:border-acc"
        @click="adding = true"
      >
        {{ t('team.addProject') }}
      </button>
      <ProjectCreateForm v-else @created="created" @cancel="adding = false" />
    </div>

    <p class="m-0 text-[11px] text-txt-low">{{ t('team.projectsFoot') }}</p>
  </section>
</template>
