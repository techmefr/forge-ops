<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import type { BudgetSettings, Fleet, Story } from '@/domain/Board/BoardModel'
import { MEMORY_PER_SESSION_MB, estimateRun } from './Estimate'

const fleet = useResource<Fleet>(() => board.read('/api/fleet'))
const budget = useResource<BudgetSettings>(() => board.read('/api/settings/budget'))
const backlog = useResource<readonly Story[]>(() => board.read('/api/stories/backlog'))
const planned = ref(1)

const estimate = computed(() =>
  estimateRun({
    stories: planned.value,
    capUsd: budget.data.value?.policy.capUsd ?? 0,
    spentUsd: budget.data.value?.spentUsd ?? 0,
  }),
)

const jobs = computed(() => fleet.data.value?.jobs ?? [])

const tokens = computed(() =>
  jobs.value.reduce((total, job) => total + (job.tokens ?? 0), 0),
)

onMounted(() => Promise.all([fleet.reload(), budget.reload(), backlog.reload()]))
</script>

<template>
  <div class="p-8">
    <div class="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Sessions vivantes</p>
        <p class="display-italic mt-1 text-3xl">{{ jobs.length }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Superviseurs</p>
        <p class="display-italic mt-1 text-3xl">{{ fleet.data.value?.roster?.workerCount ?? 0 }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Jetons en vol</p>
        <p class="display-italic mt-1 text-3xl">{{ tokens }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Depense du jour</p>
        <p class="display-italic mt-1 text-3xl">
          {{ (budget.data.value?.spentUsd ?? 0).toFixed(2) }} $
        </p>
        <p class="mt-1 font-mono text-[11px] text-txt-low">
          plafond {{ (budget.data.value?.policy.capUsd ?? 0).toFixed(2) }} $
        </p>
      </article>
    </div>

    <section
      class="mt-6 rounded-2xl border p-5"
      :class="estimate.affordable ? 'border-line bg-card' : 'border-red bg-red-soft/10'"
    >
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        Estimation avant de lancer un lot
      </p>
      <div class="mt-3 flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-mid">Stories a lancer</span>
          <input
            v-model.number="planned"
            type="number"
            min="0"
            :max="(backlog.data.value ?? []).length"
            class="w-24 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">Cout estime</p>
          <p class="display-italic text-2xl">{{ estimate.costUsd.toFixed(2) }} $</p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">Reste sous le plafond</p>
          <p class="display-italic text-2xl">{{ estimate.remainingUsd.toFixed(2) }} $</p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">Memoire estimee</p>
          <p class="display-italic text-2xl">{{ estimate.memoryMb }} Mo</p>
        </div>
      </div>
      <p v-if="!estimate.affordable" class="mt-3 text-xs text-red">
        Ce lot creve le plafond. Le board coupera selon la conduite choisie dans les reglages.
      </p>
      <p class="mt-2 text-[11px] text-txt-low">
        Compte {{ MEMORY_PER_SESSION_MB }} Mo par session, {{ (backlog.data.value ?? []).length }} stories
        disponibles au backlog.
      </p>
    </section>

    <div class="mt-6">
      <ScreenState
        :pending="fleet.pending.value"
        :failure="fleet.failure.value"
        :empty="jobs.length === 0"
        empty-label="Aucune session vivante."
        @retry="fleet.reload()"
      >
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-line text-txt-low">
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">Session</th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">Etat</th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">Intention</th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">Jetons</th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">Version</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id" class="border-b border-line/60">
              <td class="py-2 font-mono text-[11px] text-txt-hi">{{ job.name ?? job.id }}</td>
              <td class="py-2 text-txt-mid">{{ job.state }}</td>
              <td class="py-2 text-txt-mid">{{ job.intent ?? '—' }}</td>
              <td class="py-2 font-mono text-[11px] text-txt-mid">{{ job.tokens ?? 0 }}</td>
              <td class="py-2 font-mono text-[11px] text-txt-low">{{ job.cliVersion ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </ScreenState>
    </div>
  </div>
</template>
