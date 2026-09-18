<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { clearSpot, lightSpot } from '@/technical/Ui/Spotlight'
import { useTour } from './UseTour'
import GhostPointer from './GhostPointer.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const tour = useTour()

const title = computed(() => {
  const step = tour.step.value
  return step === null ? '' : t(step.titleKey)
})

const say = computed(() => {
  const step = tour.step.value
  return step === null ? '' : t(step.sayKey)
})

const gesture = computed(() => tour.step.value?.gesture ?? 'point')

const anchor = computed(() => (tour.open.value ? (tour.step.value?.anchor ?? null) : null))

const panel = ref<HTMLElement | null>(null)
const heading = ref<HTMLElement | null>(null)

async function placeOnStep(): Promise<void> {
  const step = tour.step.value
  if (step === null) {
    clearSpot()
    return
  }
  if (route.path !== step.path) {
    await router.push(step.path)
  }
  await nextTick()
  lightSpot(step.anchor, t('tour.spot'))
  heading.value?.focus?.()
}

function leave(): void {
  tour.dismiss()
  clearSpot()
}

function onKey(event: KeyboardEvent): void {
  if (!tour.open.value) {
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    leave()
    return
  }
  if (panel.value === null || !panel.value.contains(event.target as Node)) {
    return
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault()
    tour.goNext()
    return
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    tour.goBack()
  }
}

watch(() => tour.step.value?.id ?? null, () => void placeOnStep(), { flush: 'post' })

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  await tour.awake()
  await placeOnStep()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearSpot()
})
</script>

<template>
  <button
    v-if="tour.offered.value"
    type="button"
    class="fixed right-5 bottom-5 z-50 rounded-full border border-acc bg-panel px-4 py-2 font-mono text-[11px] font-bold text-acc uppercase"
    @click="tour.reopen()"
  >
    {{ t('tour.reopen') }}
  </button>

  <GhostPointer :anchor="anchor" :gesture="gesture" />

  <aside
    v-if="tour.open.value && tour.step.value !== null"
    ref="panel"
    role="dialog"
    aria-modal="false"
    :aria-label="t('tour.label')"
    class="fixed right-5 bottom-5 z-50 flex w-[min(380px,calc(100vw-2.5rem))] flex-col gap-3 rounded-2xl border border-acc bg-panel p-5 shadow-2xl"
  >
    <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase" role="status">
      {{ t('tour.progress', { current: tour.index.value + 1, total: tour.total }) }}
    </p>

    <h2 ref="heading" tabindex="-1" class="display-italic m-0 text-lg text-txt-hi outline-none">
      {{ title }}
    </h2>

    <p class="text-[13px] leading-relaxed text-txt-mid">{{ say }}</p>

    <div class="mt-1 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-lg border border-line bg-card px-3 py-2 text-[11px] font-bold text-txt-mid uppercase disabled:opacity-40"
        :disabled="tour.first.value"
        @click="tour.goBack()"
      >
        {{ t('tour.previous') }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-acc bg-acc px-3 py-2 text-[11px] font-bold text-ink uppercase"
        @click="tour.goNext()"
      >
        {{ tour.last.value ? t('tour.finish') : t('tour.next') }}
      </button>
      <button
        type="button"
        class="ml-auto rounded-lg border border-line bg-card px-3 py-2 text-[11px] font-bold text-txt-low uppercase"
        @click="leave()"
      >
        {{ t('tour.skip') }}
      </button>
    </div>

    <p class="text-[11px] text-txt-low">{{ t('tour.hint') }}</p>
  </aside>
</template>
