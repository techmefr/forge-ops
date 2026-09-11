<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { gaugesOf, type MachineSnapshot } from './MachineGauge'
import Glyph from '@/technical/Ui/Glyph.vue'

type MachineReading = {
  available: boolean
  reason: string | null
  snapshot: MachineSnapshot | null
}

const reading = ref<MachineReading | null>(null)
const gauges = computed(() => gaugesOf(reading.value?.snapshot ?? null))

let beat: ReturnType<typeof setInterval> | null = null

async function look(): Promise<void> {
  try {
    reading.value = await board.read<MachineReading>('/api/machine')
  } catch {
    reading.value = null
  }
}

onMounted(() => {
  void look()
  beat = setInterval(() => void look(), 5000)
})

onBeforeUnmount(() => {
  if (beat !== null) {
    clearInterval(beat)
  }
})

function colourOf(percent: number | null): string {
  if (percent === null) {
    return 'bg-line'
  }
  if (percent >= 90) {
    return 'bg-red'
  }
  return percent >= 70 ? 'bg-orange' : 'bg-green'
}
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5" role="group" aria-label="Etat de la machine">
    <p v-if="gauges.length === 0" class="font-mono text-[10px] text-txt-low uppercase">machine muette</p>
    <div v-for="gauge in gauges" :key="gauge.name" class="flex items-center gap-1.5">
      <span class="flex items-center gap-1 font-mono text-[9.5px] tracking-[0.14em] text-txt-low uppercase">
        <Glyph :name="gauge.glyph" :size="13" />
        {{ gauge.name }}
      </span>
      <span class="h-1 w-8 overflow-hidden rounded-full bg-elev">
        <span
          class="block h-full rounded-full"
          :class="colourOf(gauge.percent)"
          :style="{ width: `${Math.min(gauge.percent ?? 0, 100)}%` }"
        />
      </span>
      <span class="font-mono text-[10px] whitespace-nowrap text-txt-mid">{{ gauge.said }}</span>
    </div>
  </div>
</template>
