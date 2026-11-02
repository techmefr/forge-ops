<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

export type TwinDraft = { title: string; body: string }

const props = defineProps<{
  busy: boolean
  submit: (draft: TwinDraft) => Promise<boolean>
}>()

const { t } = useI18n()

const twinTitle = ref('')
const twinBody = ref('')

async function submitTwin(): Promise<void> {
  const done = await props.submit({ title: twinTitle.value, body: twinBody.value })
  if (done) {
    twinTitle.value = ''
    twinBody.value = ''
  }
}
</script>

<template>
  <form
    class="mt-6 flex flex-col gap-2 card p-4"
    @submit.prevent="submitTwin"
  >
    <p class="title-face text-sm text-violet">{{ t('story.twinTitle') }}</p>
    <input
      v-model="twinTitle"
      type="text"
      :placeholder="t('story.twinTitlePlaceholder')"
      :aria-label="t('story.twinTitlePlaceholder')"
      class="field"
    />
    <textarea
      v-model="twinBody"
      rows="3"
      :placeholder="t('story.twinBodyPlaceholder')"
      :aria-label="t('story.twinBodyPlaceholder')"
      class="field"
    ></textarea>
    <button
      type="submit"
      :disabled="busy"
      class="rounded-lg bg-card px-3 py-2 text-sm font-bold text-violet disabled:opacity-50"
    >
      {{ t('story.writeTwin') }}
    </button>
  </form>
</template>
