<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { clearSpot, findSpot, lightSpot } from '@/technical/Ui/Spotlight'
import { LOGIN_PATH } from '@/technical/Api/Board'
import { useTour } from './UseTour'
import GhostPointer from './GhostPointer.vue'
import { popoverCorner, type Corner } from './TourPlacement'

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
const reopenButton = ref<HTMLButtonElement | null>(null)

const SETTLE_MS = 450

const CORNER_CLASSES: Record<Corner, string> = {
  'bottom-right': 'bottom-14 right-3 sm:right-5',
  'bottom-left': 'bottom-14 left-3 sm:left-5',
  'top-right': 'top-3 right-3 sm:right-5',
  'top-left': 'top-3 left-3 sm:left-5',
}

const corner = ref<Corner>('bottom-right')
let settleTimer = 0
let arriving = true

function steerAway(): void {
  const node = panel.value
  const step = tour.step.value
  if (node === null || step === null) {
    return
  }
  corner.value = popoverCorner(
    findSpot(step.anchor)?.getBoundingClientRect() ?? null,
    { width: node.offsetWidth, height: node.offsetHeight },
    { width: window.innerWidth, height: window.innerHeight },
  )
}

const SPOT_ATTEMPTS = 12
const SPOT_RETRY_MS = 150

async function spotAppears(anchor: string): Promise<void> {
  for (let attempt = 0; attempt < SPOT_ATTEMPTS && findSpot(anchor) === null; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, SPOT_RETRY_MS))
  }
}

async function placeOnStep(navigate: boolean): Promise<void> {
  if (window.location.pathname === LOGIN_PATH) {
    clearSpot()
    return
  }
  const step = tour.step.value
  if (step === null) {
    clearSpot()
    return
  }
  if (navigate && route.path !== step.path) {
    await router.push(step.path)
  }
  await nextTick()
  await spotAppears(step.anchor)
  lightSpot(step.anchor, t('tour.spot'))
  steerAway()
  window.clearTimeout(settleTimer)
  settleTimer = window.setTimeout(steerAway, SETTLE_MS)
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

watch(
  () => tour.step.value?.id ?? null,
  () => {
    if (!arriving) {
      void placeOnStep(true)
    }
  },
  { flush: 'post' },
)
watch(
  () => tour.open.value,
  async (isOpen, wasOpen) => {
    if (isOpen || !wasOpen) {
      return
    }
    await nextTick()
    reopenButton.value?.focus()
  },
)
watch(
  () => route.path === LOGIN_PATH,
  (stillOnLogin) => {
    if (!stillOnLogin) {
      void placeOnStep(false)
    }
  },
)

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', steerAway)
  await tour.awake()
  await placeOnStep(false)
  await nextTick()
  arriving = false
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', steerAway)
  window.clearTimeout(settleTimer)
  clearSpot()
})
</script>

<template>
  <Teleport to="#tour-slot" defer>
    <button
      v-if="tour.offered.value"
      ref="reopenButton"
      type="button"
      class="min-h-10 rounded-md border-0 bg-transparent px-2 text-xs text-acc hover:bg-elev sm:min-h-9 sm:px-3"
      @click="tour.reopen()"
    >
      {{ t('tour.reopen') }}
    </button>
  </Teleport>

  <GhostPointer :anchor="anchor" :gesture="gesture" />

  <div
    v-if="tour.open.value && tour.step.value !== null"
    ref="panel"
    role="dialog"
    aria-modal="false"
    :aria-label="t('tour.label')"
    :class="CORNER_CLASSES[corner]"
    class="fixed z-50 flex w-[min(380px,calc(100vw-1.5rem))] flex-col gap-3 rounded-lg bg-panel p-6 shadow-2xl"
  >
    <p class="text-xs text-txt-low" role="status">
      {{ t('tour.progress', { current: tour.index.value + 1, total: tour.total }) }}
    </p>

    <h2 ref="heading" tabindex="-1" class="title-face m-0 text-[22px] text-txt-hi outline-none">
      {{ title }}
    </h2>

    <p class="text-sm leading-relaxed text-txt-mid">{{ say }}</p>

    <div class="mt-1 flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="tour.first.value"
        @click="tour.goBack()"
      >
        {{ t('tour.previous') }}
      </button>
      <button
        type="button"
        class="btn btn-primary btn-sm"
        @click="tour.goNext()"
      >
        {{ tour.last.value ? t('tour.finish') : t('tour.next') }}
      </button>
      <button
        type="button"
        class="ml-auto rounded-lg bg-card px-3 py-2 text-xs font-bold text-txt-low"
        @click="leave()"
      >
        {{ t('tour.skip') }}
      </button>
    </div>

    <p class="text-xs text-txt-low">{{ t('tour.hint') }}</p>
  </div>
</template>
