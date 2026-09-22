<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { SessionActivityEntry } from '@/domain/Board/BoardModel'
import { sessionEndKey } from '@/domain/Agent/SessionEnd'
import { dotColourOf } from '@/domain/Agent/OutcomeColour'
import { saidWhen } from './Moment'

const props = defineProps<{ entries: readonly SessionActivityEntry[] }>()

const { t, d } = useI18n()
const say = usePhrase()

function spokenWhen(written: string): string {
  const moment = saidWhen(written, new Date())
  return moment.said === null ? d(moment.date ?? new Date(), 'dayTime') : say(moment.said)
}
</script>

<template>
  <div v-if="props.entries.length > 0" class="flex flex-col gap-1.5">
    <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
      {{ t('sessionActivity.title') }}
    </p>
    <ul class="flex flex-col gap-1" :aria-label="t('sessionActivity.aria')">
      <li
        v-for="entry in props.entries"
        :key="entry.claudeSessionId"
        class="flex items-center gap-2 text-[11px]"
      >
        <span
          class="h-1.5 w-1.5 flex-none rounded-full"
          :class="dotColourOf(entry.outcome, entry.lifecycle)"
          aria-hidden="true"
        />
        <span class="text-txt-hi">{{ t(`phase.${entry.phase}`) }}</span>
        <span class="truncate text-txt-low">{{ entry.agentName }}</span>
        <span class="ml-auto font-mono text-[10px] text-txt-low">{{
          t(sessionEndKey(entry.outcome, entry.lifecycle))
        }}</span>
        <time class="font-mono text-[10px] text-txt-low" :datetime="entry.startedAt">{{
          spokenWhen(entry.startedAt)
        }}</time>
      </li>
    </ul>
  </div>
</template>
