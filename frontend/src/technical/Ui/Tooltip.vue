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
          class="z-50 max-w-60 rounded-sm bg-tip px-2 py-1 text-xs text-tip-ink shadow-md"
        >
          {{ label }}
          <TooltipArrow class="fill-tip" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
