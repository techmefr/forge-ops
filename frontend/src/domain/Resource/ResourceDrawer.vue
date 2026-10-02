<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import ResourceScreen from '@/domain/Resource/ResourceScreen.vue'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()

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
        class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-hair bg-panel shadow-lg min-[760px]:w-[min(880px,100vw)]"
        data-test="resource-drawer"
      >
        <header class="flex flex-none items-center gap-3 border-b border-hair px-5 py-3">
          <DialogTitle class="m-0 flex-1 text-sm font-semibold text-txt-hi">
            {{ t('forge.resource.detailsTitle') }}
          </DialogTitle>
          <DialogDescription class="sr-only">{{ t('forge.resource.aria') }}</DialogDescription>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="emit('close')"
          >
            {{ t('forge.resource.close') }}
          </button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto">
          <ResourceScreen />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
