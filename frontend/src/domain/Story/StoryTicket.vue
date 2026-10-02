<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Ticket } from '@/domain/Board/BoardModel'
import { partOf, type StoryPart } from './StoryPart'
import type { TicketPoint } from './TicketRequest'

const { ticket, part } = defineProps<{ ticket: Ticket | null; part: StoryPart }>()
const emit = defineEmits<{ pick: [TicketPoint] }>()

const { t, te } = useI18n()

function gapLabel(gap: string, position: number): string {
  const code = ticket?.completeness.gapCodes?.[position]
  return code !== undefined && te(`storyGap.${code}`) ? t(`storyGap.${code}`) : gap
}

const shown = computed(() => partOf(ticket, part))

const scoreColour = computed(() => {
  if (ticket === null) {
    return 'text-txt-low'
  }
  return ticket.completeness.launchable ? 'text-green' : 'text-orange'
})
</script>

<template>
  <p v-if="ticket === null" class="text-sm text-txt-low">{{ t('ticket.noStory') }}</p>

  <article v-else class="flex flex-col gap-5">
    <p class="text-xs text-txt-low">
      {{ t('ticket.readOnly') }}
    </p>

    <p
      v-if="shown === null"
      class="rounded-lg bg-violet-soft/10 p-4 text-sm text-txt-mid"
    >
      {{ t('ticket.partNotWritten', { part: t(`storyPart.${part}`) }) }}
    </p>

    <header v-else class="border-t border-hair pt-4">
      <div class="flex items-baseline gap-2">
        <span class="font-mono whitespace-nowrap text-xs font-semibold text-acc">{{ shown.reference }}</span>
        <span class="text-xs text-txt-low">{{
          t(`state.${shown.state}`)
        }}</span>
      </div>

      <button
        type="button"
        class="mt-1 block w-full text-left hover:text-acc"
        @click="emit('pick', { kind: 'title', text: shown.title })"
      >
        <h2 class="title-face text-lg">{{ shown.title }}</h2>
      </button>

      <button
        type="button"
        class="mt-2 block w-full text-left text-sm whitespace-pre-wrap text-txt-mid hover:text-acc"
        @click="emit('pick', { kind: 'body', text: shown.body })"
      >
        {{ shown.body }}
      </button>

      <p class="mt-3 tabular-nums text-xs" :class="scoreColour">
        {{ t('ticket.completeness', { score: ticket.completeness.score }) }}
        <span v-if="!ticket.completeness.launchable"> {{ t('ticket.belowLaunch') }}</span>
      </p>
      <ul v-if="ticket.completeness.gaps.length > 0" class="mt-2 flex flex-col gap-1">
        <li v-for="(gap, position) in ticket.completeness.gaps" :key="gap">
          <button
            type="button"
            class="w-full text-left text-sm text-orange hover:underline"
            @click="emit('pick', { kind: 'gap', text: gapLabel(gap, position) })"
          >
            {{ gapLabel(gap, position) }}
          </button>
        </li>
      </ul>
    </header>

    <section class="border-t border-hair pt-4">
      <p class="text-xs text-txt-low">
        {{ t('ticket.criteria') }}
      </p>
      <p v-if="ticket.criteria.length === 0" class="mt-2 text-sm text-orange">
        {{ t('ticket.noCriteria') }}
      </p>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="criterion in ticket.criteria" :key="criterion.id">
          <button
            type="button"
            class="flex w-full gap-2 text-left text-sm hover:text-acc"
            @click="emit('pick', { kind: 'criterion', text: criterion.statement })"
          >
            <span
              class="mt-0.5 h-2 w-2 flex-none rounded-full"
              :class="criterion.satisfied ? 'bg-green' : 'bg-line'"
            />
            <span>
              <span class="font-mono whitespace-nowrap text-xs text-txt-low">{{ criterion.reference }}</span>
              <span class="ml-1.5 text-txt-hi">{{ criterion.statement }}</span>
              <span v-if="criterion.expectsRefusal" class="ml-1.5 text-orange">{{
                t('ticket.expectsRefusal')
              }}</span>
              <span v-if="criterion.persona !== null" class="ml-1.5 text-txt-low"
                >· {{ criterion.persona }}</span
              >
            </span>
          </button>
        </li>
      </ul>
    </section>

    <section class="border-t border-hair pt-4">
      <p class="text-xs text-txt-low">
        {{ t('ticket.definitionOfDone') }}
      </p>
      <ol class="mt-2 flex flex-col gap-1.5">
        <li v-for="step in ticket.dod" :key="step.name">
          <button
            type="button"
            class="flex w-full items-center gap-2 text-left text-sm hover:text-acc"
            :class="step.proven ? 'text-txt-hi' : 'text-txt-low'"
            @click="emit('pick', { kind: 'step', text: t(`checkpoint.${step.name}`) })"
          >
            <span
              class="h-2 w-2 flex-none rounded-full"
              :class="step.proven ? 'bg-green' : 'bg-line'"
            />
            {{ t(`checkpoint.${step.name}`) }}
            <span v-if="step.evidencePath !== null" class="ml-auto font-mono text-xs text-acc">{{
              step.evidencePath
            }}</span>
          </button>
        </li>
      </ol>
    </section>

    <section v-if="ticket.blockers.length > 0" class="rounded-lg bg-red-soft/10 p-4">
      <p class="text-xs text-red">
        {{ t('ticket.blockedBy') }}
      </p>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="blocker in ticket.blockers" :key="blocker" class="tabular-nums text-xs text-txt-hi">
          {{ blocker }}
        </li>
      </ul>
    </section>
  </article>
</template>
