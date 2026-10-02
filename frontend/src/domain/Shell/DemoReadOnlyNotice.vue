<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { listenToDemoStream } from '@/technical/Api/DemoStream'

const VISIBLE_MS = 6000

const { t } = useI18n()
const shown = ref(false)
let timer: number | undefined

const stop = listenToDemoStream((event) => {
  if (event.name !== 'demo.readonly') {
    return
  }
  shown.value = true
  window.clearTimeout(timer)
  timer = window.setTimeout(() => {
    shown.value = false
  }, VISIBLE_MS)
})

onBeforeUnmount(() => {
  stop()
  window.clearTimeout(timer)
})
</script>

<template>
  <div class="pointer-events-none fixed right-3 bottom-3 z-50 max-w-[340px]" role="status" aria-live="polite">
    <p
      v-if="shown"
      class="pointer-events-auto rounded-lg bg-panel p-3 text-sm leading-snug text-txt-hi shadow-lg"
      data-test-id="demo-readonly"
    >
      {{ t('visit.readOnly') }}
    </p>
  </div>
</template>
