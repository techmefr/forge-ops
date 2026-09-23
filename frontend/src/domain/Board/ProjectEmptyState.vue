<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProjectCreateForm from './ProjectCreateForm.vue'

const emit = defineEmits<{ created: [] }>()

const { t } = useI18n()
const creating = ref(false)

function onCreated(): void {
  creating.value = false
  emit('created')
}
</script>

<template>
  <section
    class="flex flex-col gap-4 rounded-lg border border-line bg-card p-6"
    :aria-label="t('emptyState.title')"
  >
    <div>
      <p class="display-italic text-[22px]">{{ t('emptyState.title') }}</p>
      <p class="mt-1 text-[13px] text-txt-low">{{ t('emptyState.body') }}</p>
    </div>

    <ProjectCreateForm v-if="creating" @created="onCreated" @cancel="creating = false" />

    <div v-else class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg border border-acc bg-acc px-4 py-2.5 text-[11px] font-bold text-ink uppercase"
        @click="creating = true"
      >
        {{ t('emptyState.createProject') }}
      </button>
      <RouterLink to="/settings" class="text-[13px] text-acc underline">
        {{ t('emptyState.reviewWorkflow') }}
      </RouterLink>
    </div>
  </section>
</template>
