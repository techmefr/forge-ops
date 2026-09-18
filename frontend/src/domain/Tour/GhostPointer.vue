<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { TourGesture, TourSpot } from '../../../../contract/TourContract'
import { findSpot, prefersReducedMotion } from '@/technical/Ui/Spotlight'
import {
  aimDelayOf,
  centreOf,
  moveOf,
  pulsesOf,
  spotAt,
  travelMillisOf,
} from './TourGesture'

const props = defineProps<{ anchor: string | null; gesture: TourGesture }>()

const here = ref<TourSpot | null>(null)
const pulsing = ref(false)
let frame = 0
let timer = 0

function stop(): void {
  if (frame !== 0) {
    cancelAnimationFrame(frame)
    frame = 0
  }
  if (timer !== 0) {
    window.clearTimeout(timer)
    timer = 0
  }
}

function travelTo(target: HTMLElement): void {
  const reduced = prefersReducedMotion()
  const move = moveOf(here.value, centreOf(target.getBoundingClientRect()), props.gesture)
  const millis = travelMillisOf(props.gesture, reduced)
  pulsing.value = pulsesOf(props.gesture, reduced) > 0
  if (millis === 0) {
    here.value = move.to
    return
  }
  const opened = performance.now()
  const walk = (now: number): void => {
    const progress = (now - opened) / millis
    here.value = spotAt(move, progress)
    frame = progress < 1 ? requestAnimationFrame(walk) : 0
  }
  frame = requestAnimationFrame(walk)
}

function aim(attempt: number): void {
  stop()
  if (props.anchor === null) {
    here.value = null
    return
  }
  const target = findSpot(props.anchor)
  if (target !== null) {
    travelTo(target)
    return
  }
  const delay = aimDelayOf(attempt)
  if (delay === null) {
    here.value = null
    return
  }
  timer = window.setTimeout(() => aim(attempt + 1), delay)
}

function reaim(): void {
  if (props.anchor === null || here.value === null) {
    return
  }
  const target = findSpot(props.anchor)
  if (target !== null) {
    here.value = centreOf(target.getBoundingClientRect())
  }
}

watch(() => [props.anchor, props.gesture], () => aim(0), { immediate: true, flush: 'post' })

onMounted(() => {
  window.addEventListener('resize', reaim)
  window.addEventListener('scroll', reaim, true)
})

onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', reaim)
  window.removeEventListener('scroll', reaim, true)
})
</script>

<template>
  <div
    v-if="here !== null"
    aria-hidden="true"
    class="pointer-events-none fixed z-40 -translate-x-1/2 -translate-y-1/2"
    :style="{ left: here.x + 'px', top: here.y + 'px' }"
  >
    <span
      class="block size-4 rounded-full border-2 border-acc bg-acc/40"
      :class="pulsing ? 'tour-ghost-pulse' : ''"
    />
  </div>
</template>
