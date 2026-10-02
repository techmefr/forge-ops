<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { Project } from '@/domain/Board/BoardModel'
import { board } from '@/technical/Api/Board'
import { BoardRequestError } from '@/technical/Api/BoardClient'
import { reasonOf } from '@/technical/Api/UseResource'
import type { Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'

const SWATCHES = ['#0f9d8a', '#5b6ee1', '#d9822b', '#c2477a', '#3b8ed0', '#7a9a2e'] as const
const NAME_LIMIT = 80
const REPOSITORY_EXAMPLE = 'https://git.example.com/team/repo.git'

const props = defineProps<{ name: string; count: number }>()
const emit = defineEmits<{ close: []; created: [project: Project] }>()

const { t } = useI18n()
const say = usePhrase()

const name = ref(props.name.slice(0, NAME_LIMIT))
const colour = ref<string>(SWATCHES[props.count % SWATCHES.length] ?? SWATCHES[0])
const repository = ref('')
const nameError = ref<string | null>(null)
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const nameField = ref<HTMLInputElement | null>(null)

async function create(): Promise<void> {
  refusal.value = null
  nameError.value = name.value.trim() === '' ? 'projectForm.errors.nameRequired' : null
  if (nameError.value !== null) {
    await nextTick()
    nameField.value?.focus()
    return
  }
  busy.value = true
  try {
    const created = await board.send<Project>('/api/projects', 'POST', {
      name: name.value.trim(),
      colour: colour.value,
      repository: repository.value.trim(),
    })
    emit('created', created)
  } catch (error) {
    if (error instanceof BoardRequestError && error.code === 'ProjectSlugTakenError') {
      nameError.value = 'projectForm.errors.taken'
      await nextTick()
      nameField.value?.focus()
    } else {
      refusal.value = reasonOf(error)
    }
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
      <DialogOverlay class="fixed inset-0 z-[60] bg-deep/70" />
      <DialogContent
        class="fixed top-1/2 left-1/2 z-[70] max-h-[calc(100dvh-2rem)] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-panel p-5"
        data-test-id="new-project-dialog"
      >
        <DialogTitle class="title-face text-sm text-txt-hi">
          {{ t('projectForm.title') }}
        </DialogTitle>
        <DialogDescription class="mt-1 text-sm text-txt-mid">
          {{ t('projectForm.description') }}
        </DialogDescription>

        <form class="mt-4 flex flex-col gap-3" novalidate @submit.prevent="create">
          <div class="flex flex-col gap-1 text-sm text-txt-mid">
            <label for="new-project-name">{{ t('projectForm.name') }}</label>
            <input
              id="new-project-name"
              ref="nameField"
              v-model="name"
              type="text"
              :maxlength="NAME_LIMIT"
              autocomplete="off"
              class="field"
              :class="nameError === null ? 'border-line' : 'border-red'"
              :aria-invalid="nameError !== null"
              :aria-describedby="nameError === null ? undefined : 'new-project-name-error'"
              data-test-id="new-project-name"
            />
            <p
              v-if="nameError !== null"
              id="new-project-name-error"
              class="text-xs text-red"
              data-test-id="new-project-name-error"
            >
              {{ t(nameError) }}
            </p>
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid">
            <label for="new-project-colour">{{ t('projectForm.colour') }}</label>
            <div class="flex flex-wrap items-center gap-2">
              <input
                id="new-project-colour"
                v-model="colour"
                type="color"
                class="h-8 w-10 cursor-pointer rounded-md border border-line bg-transparent p-0.5"
                data-test-id="new-project-colour"
              />
              <button
                v-for="swatch in SWATCHES"
                :key="swatch"
                type="button"
                class="bg-elev size-5 rounded-full "
                :style="{ background: swatch }"
                :aria-label="swatch"
                :aria-pressed="colour === swatch"
                :class="colour === swatch ? 'outline-2 outline-offset-1 outline-txt-hi' : ''"
                @click="colour = swatch"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1 text-sm text-txt-mid">
            <label for="new-project-repository">{{ t('projectForm.repository') }}</label>
            <input
              id="new-project-repository"
              v-model="repository"
              type="text"
              autocomplete="off"
              spellcheck="false"
              :placeholder="REPOSITORY_EXAMPLE"
              class="field font-mono"
              data-test-id="new-project-repository"
            />
            <p class="text-xs text-txt-low">{{ t('projectForm.repositoryHint') }}</p>
          </div>

          <p
            v-if="refusal !== null"
            class="rounded-md px-3 py-2 text-sm text-txt-hi"
            role="alert"
          >
            {{ say(refusal) }}
          </p>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              @click="emit('close')"
            >
              {{ t('projectForm.cancel') }}
            </button>
            <button
              type="submit"
              :disabled="busy"
              class="btn btn-primary btn-sm"
              data-test-id="new-project-create"
            >
              {{ t('projectForm.create') }}
            </button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
