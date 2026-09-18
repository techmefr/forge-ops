<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { BoardStatistics, SessionHistoryEntry } from '@/domain/Board/BoardModel'
import { sessionEndKey } from '@/domain/Agent/SessionEnd'
import { humanDuration } from './Duration'

const OUTCOME_COLOURS: Readonly<Record<string, string>> = {
  succeeded: 'text-green',
  awaiting_human: 'text-warn',
  failed: 'text-red',
  killed: 'text-red',
  timed_out: 'text-orange',
  budget_exhausted: 'text-orange',
  permission_denied: 'text-orange',
  looping: 'text-orange',
  interrupted: 'text-txt-mid',
  runner_missing: 'text-red',
  unknown: 'text-txt-low',
}

const { t } = useI18n()
const say = usePhrase()

const summary = useResource<BoardStatistics>(() => board.read('/api/statistics'))
const history = useResource<readonly SessionHistoryEntry[]>(() => board.read('/api/sessions/history'))

const busiest = computed(() => summary.data.value?.agents.slice(0, 6) ?? [])

function colourOf(outcome: string | null): string {
  return outcome === null ? 'text-txt-low' : (OUTCOME_COLOURS[outcome] ?? 'text-txt-low')
}

onMounted(() => Promise.all([summary.reload(), history.reload()]))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-8">
    <div class="grid flex-none gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('statistic.sessions') }}
        </p>
        <p class="display-italic mt-1 text-3xl">{{ summary.data.value?.sessions ?? 0 }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('statistic.totalCost') }}
        </p>
        <p class="display-italic mt-1 text-3xl">
          {{ t('common.money', { amount: (summary.data.value?.totalCostUsd ?? 0).toFixed(2) }) }}
        </p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('statistic.machineTime') }}
        </p>
        <p class="display-italic mt-1 text-3xl">
          {{ say(humanDuration(summary.data.value?.totalSeconds ?? 0)) }}
        </p>
      </article>
    </div>

    <div class="mt-2 min-h-0 flex-1 overflow-auto pr-1">
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('statistic.busiestAgents') }}
        </p>
        <p v-if="busiest.length === 0" class="mt-2 text-xs text-txt-low">
          {{ t('statistic.noSessionYet') }}
        </p>
        <ul class="mt-3 flex flex-col gap-2">
          <li v-for="agent in busiest" :key="agent.agentName" class="text-xs">
            <div class="flex items-center gap-2">
              <span class="font-mono text-[11px] text-txt-hi">{{ agent.agentName }}</span>
              <span class="ml-auto font-mono text-[10px] text-txt-low"
                >{{ t('statistic.sessionCount', { count: agent.sessions }, agent.sessions) }} ·
                {{ t('common.money', { amount: agent.totalCostUsd.toFixed(2) }) }}</span
              >
            </div>
            <div class="mt-1 h-1.5 rounded bg-elev">
              <div
                class="h-full rounded bg-acc"
                :style="{
                  width: `${Math.round((agent.sessions / Math.max(summary.data.value?.sessions ?? 1, 1)) * 100)}%`,
                }"
              />
            </div>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('statistic.timePerPhase') }}
        </p>
        <ul class="mt-3 flex flex-col gap-2">
          <li
            v-for="phase in summary.data.value?.phases ?? []"
            :key="phase.phase"
            class="flex items-center gap-2 text-xs"
          >
            <span class="font-mono text-[11px] text-txt-hi">{{ t(`phase.${phase.phase}`) }}</span>
            <span class="ml-auto font-mono text-[10px] text-txt-low"
              >{{ t('statistic.sessionCount', { count: phase.sessions }, phase.sessions) }} ·
              {{ say(humanDuration(phase.totalSeconds)) }}</span
            >
          </li>
        </ul>

        <p class="mt-5 font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('statistic.howSessionsEnd') }}
        </p>
        <ul class="mt-3 flex flex-col gap-1.5">
          <li
            v-for="outcome in summary.data.value?.outcomes ?? []"
            :key="outcome.outcome"
            class="flex items-center gap-2 text-xs"
          >
            <span class="font-mono text-[11px]" :class="colourOf(outcome.outcome)">{{
              t(sessionEndKey(outcome.outcome, 'finished'))
            }}</span>
            <span class="ml-auto font-mono text-[10px] text-txt-low">{{ outcome.sessions }}</span>
          </li>
        </ul>
      </section>
    </div>

    <section class="mt-6">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('statistic.sessionHistory') }}
      </p>
      <div class="mt-3">
        <ScreenState
          :pending="history.pending.value"
          :failure="history.failure.value"
          :empty="(history.data.value ?? []).length === 0"
          empty-key="statistic.empty"
          @retry="history.reload()"
        >
          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-left text-xs">
              <thead>
                <tr class="border-b border-line text-txt-low">
                  <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {{ t('statistic.colStory') }}
                  </th>
                  <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {{ t('statistic.colPhase') }}
                  </th>
                  <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {{ t('statistic.colAgent') }}
                  </th>
                  <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {{ t('statistic.colDuration') }}
                  </th>
                  <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {{ t('statistic.colCost') }}
                  </th>
                  <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                    {{ t('statistic.colOutcome') }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in history.data.value ?? []" :key="entry.id" class="border-b border-line/60">
                  <td class="py-2">
                    <RouterLink :to="`/me/stories/${entry.storyId}`" class="font-mono text-[11px] text-acc">{{
                      entry.storyReference
                    }}</RouterLink>
                  </td>
                  <td class="py-2 text-txt-mid">{{ t(`phase.${entry.phase}`) }}</td>
                  <td class="py-2 font-mono text-[11px] text-txt-hi">{{ entry.agentName }}</td>
                  <td class="py-2 text-txt-mid">{{ say(humanDuration(entry.seconds)) }}</td>
                  <td class="py-2 font-mono text-[11px] text-txt-mid">
                    {{
                      entry.costUsd === null
                        ? t('common.nothing')
                        : t('common.money', { amount: entry.costUsd.toFixed(2) })
                    }}
                  </td>
                  <td class="py-2 font-mono text-[11px]" :class="colourOf(entry.outcome)">
                    {{ t(sessionEndKey(entry.outcome, entry.lifecycle)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ScreenState>
      </div>
    </section>
    </div>
  </div>
</template>
