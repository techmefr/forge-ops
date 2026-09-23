<script setup lang="ts">
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipProvider, TooltipRoot, TooltipTrigger } from 'reka-ui'

const { label, side = 'top' } = defineProps<{ label: string; side?: 'top' | 'right' | 'bottom' | 'left' }>()
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side"
          :side-offset="6"
          class="z-50 rounded-md border border-line bg-elev px-2.5 py-1.5 text-[11px] text-txt-hi shadow-none"
        >
          {{ label }}
          <TooltipArrow class="fill-elev" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
