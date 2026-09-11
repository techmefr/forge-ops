<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import {
  FLEET_JOB_STATE_SEQUENCE,
  type BudgetSettings,
  type Fleet,
  type MachineReading,
  type Story,
} from '@/domain/Board/BoardModel'
import { MEMORY_PER_SESSION_MB, estimateRun } from './Estimate'
import { isWorking } from '@/domain/Shell/UseFleet'

const { t } = useI18n()

const fleet = useResource<Fleet>(() => board.read('/api/fleet'))
const budget = useResource<BudgetSettings>(() => board.read('/api/settings/budget'))
const backlog = useResource<readonly Story[]>(() => board.read('/api/stories/backlog'))
const machine = useResource<MachineReading>(() => board.read('/api/machine'))
const planned = ref(1)

const estimate = computed(() =>
  estimateRun({
    stories: planned.value,
    capUsd: budget.data.value?.policy.capUsd ?? 0,
    spentUsd: budget.data.value?.spentUsd ?? 0,
  }),
)

const jobs = computed(() => fleet.data.value?.jobs ?? [])
const alive = computed(() => jobs.value.filter(isWorking))
const waiting = computed(() => (backlog.data.value ?? []).length)

const tokens = computed(() => alive.value.reduce((total, job) => total + (job.tokens ?? 0), 0))

function jobState(state: string): string {
  return (FLEET_JOB_STATE_SEQUENCE as readonly string[]).includes(state)
    ? t(`fleetState.${state}`)
    : state
}

onMounted(() => Promise.all([fleet.reload(), budget.reload(), backlog.reload(), machine.reload()]))
</script>

<template>
  <div class="flex h-full min-h-0 flex-col p-8">
    <div class="grid flex-none gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('resource.liveSessions') }}
        </p>
        <p class="display-italic mt-1 text-3xl">{{ alive.length }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('resource.supervisors') }}
        </p>
        <p class="display-italic mt-1 text-3xl">{{ fleet.data.value?.roster?.workerCount ?? 0 }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('resource.tokensInFlight') }}
        </p>
        <p class="display-italic mt-1 text-3xl">{{ tokens }}</p>
      </article>
      <article class="rounded-2xl border border-line bg-card p-4">
        <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          {{ t('resource.spentToday') }}
        </p>
        <p class="display-italic mt-1 text-3xl">
          {{ t('common.money', { amount: (budget.data.value?.spentUsd ?? 0).toFixed(2) }) }}
        </p>
        <p class="mt-1 font-mono text-[11px] text-txt-low">
          {{ t('resource.cap', { amount: (budget.data.value?.policy.capUsd ?? 0).toFixed(2) }) }}
        </p>
      </article>
    </div>

    <div class="mt-2 min-h-0 flex-1 overflow-auto pr-1">
    <section class="mt-4 rounded-2xl border border-line bg-card p-5">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('resource.machineReading') }}
      </p>
      <p
        v-if="machine.data.value !== null && !machine.data.value.available"
        class="mt-2 text-xs text-txt-low"
      >
        {{ machine.data.value.reason }}
      </p>
      <div
        v-else-if="machine.data.value?.snapshot !== null && machine.data.value !== null"
        class="mt-3 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]"
      >
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">{{ t('resource.processor') }}</p>
          <p class="display-italic text-2xl">
            {{ t('common.percent', { value: machine.data.value.snapshot.cpuPercent ?? '--' }) }}
          </p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">{{ t('resource.memoryUsed') }}</p>
          <p class="display-italic text-2xl">
            {{ t('resource.megabytes', { value: machine.data.value.snapshot.memoryUsedMb ?? '--' }) }}
          </p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">{{ t('resource.memoryFree') }}</p>
          <p class="display-italic text-2xl">
            {{ t('resource.megabytes', { value: machine.data.value.snapshot.memoryFreeMb ?? '--' }) }}
          </p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">{{ t('resource.disk') }}</p>
          <p class="display-italic text-2xl">
            {{ t('common.percent', { value: machine.data.value.snapshot.diskPercent ?? '--' }) }}
          </p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">{{ t('resource.load1') }}</p>
          <p class="display-italic text-2xl">
            {{ machine.data.value.snapshot.loadAverage ?? '--' }}
          </p>
        </div>
      </div>
    </section>

    <section
      class="mt-6 rounded-2xl border p-5"
      :class="estimate.affordable ? 'border-line bg-card' : 'border-red bg-red-soft/10'"
    >
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('resource.estimateTitle') }}
      </p>
      <div class="mt-3 flex flex-wrap items-end gap-4">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-mid">{{ t('resource.storiesToLaunch') }}</span>
          <input
            v-model.number="planned"
            type="number"
            min="0"
            :max="waiting"
            class="w-24 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">{{ t('resource.estimatedCost') }}</p>
          <p class="display-italic text-2xl">
            {{ t('common.money', { amount: estimate.costUsd.toFixed(2) }) }}
          </p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">
            {{ t('resource.remainingUnderCap') }}
          </p>
          <p class="display-italic text-2xl">
            {{ t('common.money', { amount: estimate.remainingUsd.toFixed(2) }) }}
          </p>
        </div>
        <div>
          <p class="font-mono text-[10px] text-txt-low uppercase">
            {{ t('resource.estimatedMemory') }}
          </p>
          <p class="display-italic text-2xl">
            {{ t('resource.megabytes', { value: estimate.memoryMb }) }}
          </p>
        </div>
      </div>
      <p v-if="!estimate.affordable" class="mt-3 text-xs text-red">{{ t('resource.overCap') }}</p>
      <p class="mt-2 text-[11px] text-txt-low">
        {{
          t('resource.memoryNote', {
            perSession: MEMORY_PER_SESSION_MB,
            stories: t('resource.storyCount', { count: waiting }, waiting),
          })
        }}
      </p>
    </section>

    <div class="mt-6">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('resource.sessionsOnMachine') }}
      </p>
      <ScreenState
        :pending="fleet.pending.value"
        :failure="fleet.failure.value"
        :empty="jobs.length === 0"
        empty-key="resource.empty"
        @retry="fleet.reload()"
      >
        <table class="w-full border-collapse text-left text-xs">
          <thead>
            <tr class="border-b border-line text-txt-low">
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                {{ t('resource.colSession') }}
              </th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                {{ t('resource.colState') }}
              </th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                {{ t('resource.colIntent') }}
              </th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                {{ t('resource.colTokens') }}
              </th>
              <th class="py-2 font-mono text-[10px] tracking-[0.16em] uppercase">
                {{ t('resource.colVersion') }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="job in jobs" :key="job.id" class="border-b border-line/60">
              <td class="py-2 font-mono text-[11px] text-txt-hi">{{ job.name ?? job.id }}</td>
              <td class="py-2 text-txt-mid">{{ jobState(job.state) }}</td>
              <td class="py-2 text-txt-mid">{{ job.intent ?? t('common.nothing') }}</td>
              <td class="py-2 font-mono text-[11px] text-txt-mid">{{ job.tokens ?? 0 }}</td>
              <td class="py-2 font-mono text-[11px] text-txt-low">
                {{ job.cliVersion ?? t('common.nothing') }}
              </td>
            </tr>
          </tbody>
        </table>
      </ScreenState>
    </div>
    </div>
  </div>
</template>
