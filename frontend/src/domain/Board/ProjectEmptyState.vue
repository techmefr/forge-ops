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
    class="flex flex-col gap-4 border-t border-hair pt-6"
    :aria-label="t('emptyState.title')"
  >
    <div>
      <p class="text-base font-semibold">{{ t('emptyState.title') }}</p>
      <p class="mt-1 text-sm text-txt-low">{{ t('emptyState.body') }}</p>
    </div>

    <ProjectCreateForm v-if="creating" @created="onCreated" @cancel="creating = false" />

    <div v-else class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        class="rounded-lg bg-acc px-4 py-2.5 text-xs font-bold text-ink"
        @click="creating = true"
      >
        {{ t('emptyState.createProject') }}
      </button>
      <RouterLink to="/settings" class="text-sm text-acc underline">
        {{ t('emptyState.reviewWorkflow') }}
      </RouterLink>
    </div>
  </section>
</template>
