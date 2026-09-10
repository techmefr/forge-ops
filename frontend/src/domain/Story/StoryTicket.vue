<script setup lang="ts">
import { computed } from 'vue'
import type { Ticket } from '@/domain/Board/BoardModel'
import { CHECKPOINT_LABELS } from './Checkpoint'
import { PART_LABELS, partOf, type StoryPart } from './StoryPart'

const { ticket, part } = defineProps<{ ticket: Ticket | null; part: StoryPart }>()

const shown = computed(() => partOf(ticket, part))

const scoreColour = computed(() => {
  if (ticket === null) {
    return 'text-txt-low'
  }
  return ticket.completeness.launchable ? 'text-green' : 'text-orange'
})
</script>

<template>
  <p v-if="ticket === null" class="text-sm text-txt-low">
    Aucune story ouverte. Le ticket se remplit des que tu ecris la story.
  </p>

  <article v-else class="flex flex-col gap-5">
    <p
      v-if="shown === null"
      class="rounded-2xl border border-violet bg-violet-soft/10 p-4 text-sm text-txt-mid"
    >
      {{ PART_LABELS[part] }} pas encore ecrite. Elle prouve la fonctionnelle, et le backlog l attend.
    </p>

    <header v-else class="rounded-2xl border border-line bg-card p-4">
      <div class="flex items-baseline gap-2">
        <span class="font-mono text-[11px] font-semibold text-acc">{{ shown.reference }}</span>
        <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">{{
          shown.state
        }}</span>
      </div>
      <h2 class="display-italic mt-1 text-xl">{{ shown.title }}</h2>
      <p class="mt-2 text-sm whitespace-pre-wrap text-txt-mid">{{ shown.body }}</p>
      <p class="mt-3 font-mono text-[11px]" :class="scoreColour">
        Completude {{ ticket.completeness.score }}/100
        <span v-if="!ticket.completeness.launchable"> · rien ne partira en dessous de 60</span>
      </p>
      <ul v-if="ticket.completeness.gaps.length > 0" class="mt-2 flex flex-col gap-1">
        <li v-for="gap in ticket.completeness.gaps" :key="gap" class="text-xs text-orange">{{ gap }}</li>
      </ul>
    </header>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        Criteres d acceptation
      </p>
      <p v-if="ticket.criteria.length === 0" class="mt-2 text-xs text-orange">
        Aucun critere. La specification sera refusee.
      </p>
      <ul class="mt-2 flex flex-col gap-2">
        <li v-for="criterion in ticket.criteria" :key="criterion.id" class="flex gap-2 text-xs">
          <span
            class="mt-0.5 h-2 w-2 flex-none rounded-full"
            :class="criterion.satisfied ? 'bg-green' : 'bg-line'"
          />
          <span>
            <span class="font-mono text-[10px] text-txt-low">{{ criterion.reference }}</span>
            <span class="ml-1.5 text-txt-hi">{{ criterion.statement }}</span>
            <span v-if="criterion.expectsRefusal" class="ml-1.5 text-orange">attend un refus</span>
            <span v-if="criterion.persona !== null" class="ml-1.5 text-txt-low"
              >· {{ criterion.persona }}</span
            >
          </span>
        </li>
      </ul>
    </section>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Definition of done</p>
      <ol class="mt-2 flex flex-col gap-1.5">
        <li
          v-for="step in ticket.dod"
          :key="step.name"
          class="flex items-center gap-2 text-xs"
          :class="step.proven ? 'text-txt-hi' : 'text-txt-low'"
        >
          <span
            class="h-2 w-2 flex-none rounded-full"
            :class="step.proven ? 'bg-green' : 'bg-line'"
          />
          {{ CHECKPOINT_LABELS[step.name] }}
          <span v-if="step.evidencePath !== null" class="ml-auto font-mono text-[10px] text-acc">{{
            step.evidencePath
          }}</span>
        </li>
      </ol>
    </section>

    <section v-if="ticket.blockers.length > 0" class="rounded-2xl border border-red bg-red-soft/10 p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-red uppercase">Bloquee par</p>
      <ul class="mt-2 flex flex-col gap-1">
        <li v-for="blocker in ticket.blockers" :key="blocker" class="font-mono text-[11px] text-txt-hi">
          {{ blocker }}
        </li>
      </ul>
    </section>
  </article>
</template>
