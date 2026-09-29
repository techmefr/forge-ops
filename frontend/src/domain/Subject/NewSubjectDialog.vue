<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { Project } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'

const props = defineProps<{ projects: readonly Project[]; projectId: number | null }>()
const emit = defineEmits<{ close: []; saved: [id: number] }>()

const { t } = useI18n()
const say = usePhrase()

const chosenProject = ref(props.projectId ?? props.projects[0]?.id ?? 0)
const title = ref('')
const intent = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

const ready = computed(
  () => chosenProject.value > 0 && title.value.trim() !== '' && intent.value.trim() !== '',
)

async function create(): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    const created = await board.send<{ id: number }>('/api/epics', 'POST', {
      projectId: chosenProject.value,
      title: title.value.trim(),
      businessIntent: intent.value.trim(),
    })
    emit('saved', created.id)
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    emit('close')
  }
}
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-panel p-6"
        data-test-id="new-subject-dialog"
      >
        <DialogTitle class="display-italic text-lg text-txt-hi uppercase">
          {{ t('subjects.newDialog.title') }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-[13px] text-txt-mid">
          {{ t('subjects.newDialog.description') }}
        </DialogDescription>

        <form class="mt-4 flex flex-col gap-3" @submit.prevent="create">
          <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
            {{ t('subjects.newDialog.project') }}
            <select
              v-model="chosenProject"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              data-test-id="new-subject-project"
            >
              <option v-for="project in projects" :key="project.id" :value="project.id">{{ project.name }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
            {{ t('subjects.newDialog.subjectTitle') }}
            <input
              v-model="title"
              type="text"
              required
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              data-test-id="new-subject-title"
            />
          </label>
          <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
            {{ t('subjects.newDialog.intent') }}
            <textarea
              v-model="intent"
              rows="3"
              required
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
              data-test-id="new-subject-intent"
            />
          </label>
          <p
            v-if="refusal !== null"
            class="rounded-lg border border-red bg-red-soft/10 p-3 text-sm text-txt-hi"
            role="alert"
          >
            {{ say(refusal) }}
          </p>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase hover:border-acc"
              @click="emit('close')"
            >
              {{ t('subjects.newDialog.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="busy || !ready"
              class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
              data-test-id="new-subject-create"
            >
              {{ t('subjects.newDialog.create') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
