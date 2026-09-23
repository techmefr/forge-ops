<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Ticket } from '@/domain/Board/BoardModel'
import { partOf, type StoryPart } from './StoryPart'
import type { TicketPoint } from './TicketRequest'

const { ticket, part } = defineProps<{ ticket: Ticket | null; part: StoryPart }>()
const emit = defineEmits<{ pick: [TicketPoint] }>()

const { t } = useI18n()

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
    <p class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
      {{ t('ticket.readOnly') }}
    </p>

    <p
      v-if="shown === null"
      class="rounded-lg border border-violet bg-violet-soft/10 p-4 text-sm text-txt-mid"
    >
      {{ t('ticket.partNotWritten', { part: t(`storyPart.${part}`) }) }}
    </p>

    <header v-else class="rounded-lg border border-line bg-card p-4">
      <div class="flex items-baseline gap-2">
        <span class="font-mono text-[11px] font-semibold text-acc">{{ shown.reference }}</span>
        <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">{{
          t(`state.${shown.state}`)
        }}</span>
      </div>

      <button
        type="button"
        class="mt-1 block w-full text-left hover:text-acc"
        @click="emit('pick', { kind: 'title', text: shown.title })"
      >
        <h2 class="display-italic text-[22px]">{{ shown.title }}</h2>
      </button>

      <button
        type="button"
        class="mt-2 block w-full text-left text-sm whitespace-pre-wrap text-txt-mid hover:text-acc"
        @click="emit('pick', { kind: 'body', text: shown.body })"
      >
        {{ shown.body }}
      </button>

      <p class="mt-3 font-mono text-[11px]" :class="scoreColour">
        {{ t('ticket.completeness', { score: ticket.completeness.score }) }}
        <span v-if="!ticket.completeness.launchable"> {{ t('ticket.belowLaunch') }}</span>
      </p>
      <ul v-if="ticket.completeness.gaps.length > 0" class="mt-2 flex flex-col gap-1">
        <li v-for="gap in ticket.completeness.gaps" :key="gap">
          <button
            type="button"
            class="w-full text-left text-sm text-orange hover:underline"
            @click="emit('pick', { kind: 'gap', text: gap })"
          >
            {{ gap }}
          </button>
        </li>
      </ul>
    </header>

    <section class="rounded-lg border border-line bg-card p-4">
      <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
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
              <span class="font-mono text-[11px] text-txt-low">{{ criterion.reference }}</span>
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

    <section class="rounded-lg border border-line bg-card p-4">
      <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
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
            <span v-if="step.evidencePath !== null" class="ml-auto font-mono text-[11px] text-acc">{{
              step.evidencePath
            }}</span>
          </button>
        </li>
      </ol>
    </section>

    <section v-if="ticket.blockers.length > 0" class="rounded-lg border border-red bg-red-soft/10 p-4">
      <p class="font-mono text-[11px] tracking-[0.18em] text-red uppercase">
        {{ t('ticket.blockedBy') }}
      </p>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="blocker in ticket.blockers" :key="blocker" class="font-mono text-[11px] text-txt-hi">
          {{ blocker }}
        </li>
      </ul>
    </section>
  </article>
</template>
