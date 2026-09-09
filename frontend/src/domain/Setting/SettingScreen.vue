<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import type { BudgetPolicy, BudgetSettings, CostCapConduct } from '@/domain/Board/BoardModel'

const CONDUCTS: readonly { key: CostCapConduct; label: string; explanation: string }[] = [
  {
    key: 'stop',
    label: 'Couper',
    explanation: 'Plus aucune session ne part une fois le plafond atteint.',
  },
  {
    key: 'downgrade',
    label: 'Retrograder',
    explanation: 'Les sessions continuent sur un modele moins cher.',
  },
  {
    key: 'reroute',
    label: 'Rerouter',
    explanation: 'Les sessions partent vers une autre passerelle, en https uniquement.',
  },
]

const settings = useResource<BudgetSettings>(() => board.read('/api/settings/budget'))
const draft = ref<BudgetPolicy>({
  capUsd: 20,
  conduct: 'stop',
  downgradeModel: 'claude-haiku-4-5-20251001',
  rerouteBaseUrl: null,
})
const rerouteUrl = ref('')
const refusal = ref<string | null>(null)
const saved = ref(false)
const busy = ref(false)

const spent = computed(() => settings.data.value?.spentUsd ?? 0)
const usedPercent = computed(() =>
  Math.min(Math.round((spent.value / Math.max(draft.value.capUsd, 1)) * 100), 100),
)

async function save(): Promise<void> {
  busy.value = true
  refusal.value = null
  saved.value = false
  try {
    await board.send('/api/settings/budget', 'PUT', {
      ...draft.value,
      rerouteBaseUrl: draft.value.conduct === 'reroute' ? rerouteUrl.value : null,
    })
    saved.value = true
    await settings.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

watch(
  () => settings.data.value,
  (value) => {
    if (value !== null) {
      draft.value = { ...value.policy }
      rerouteUrl.value = value.policy.rerouteBaseUrl ?? ''
    }
  },
)

onMounted(() => settings.reload())
</script>

<template>
  <div class="max-w-3xl p-8">
    <section class="rounded-2xl border border-line bg-card p-5">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Depense du jour</p>
      <p class="display-italic mt-1 text-3xl">
        {{ spent.toFixed(2) }} $ <span class="text-txt-low">/ {{ draft.capUsd.toFixed(2) }} $</span>
      </p>
      <div class="mt-3 h-2 rounded bg-elev">
        <div
          class="h-full rounded"
          :class="usedPercent >= 100 ? 'bg-red' : 'bg-acc'"
          :style="{ width: `${usedPercent}%` }"
        />
      </div>
    </section>

    <form class="mt-6 flex flex-col gap-6" @submit.prevent="save">
      <label class="flex flex-col gap-2">
        <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase"
          >Plafond quotidien en dollars</span
        >
        <input
          v-model.number="draft.capUsd"
          type="number"
          min="0.01"
          step="0.01"
          class="w-40 rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
      </label>

      <fieldset class="flex flex-col gap-3 border-0 p-0">
        <legend class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
          Quand le plafond tombe
        </legend>
        <label
          v-for="conduct in CONDUCTS"
          :key="conduct.key"
          class="flex cursor-pointer gap-3 rounded-xl border p-3"
          :class="draft.conduct === conduct.key ? 'border-acc bg-acc-soft/10' : 'border-line bg-card'"
        >
          <input v-model="draft.conduct" type="radio" :value="conduct.key" class="mt-1" />
          <span>
            <span class="display-italic block text-sm">{{ conduct.label }}</span>
            <span class="mt-1 block text-xs text-txt-mid">{{ conduct.explanation }}</span>
          </span>
        </label>
      </fieldset>

      <label v-if="draft.conduct === 'downgrade'" class="flex flex-col gap-2">
        <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase"
          >Modele de repli</span
        >
        <input
          v-model="draft.downgradeModel"
          type="text"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
      </label>

      <label v-if="draft.conduct === 'reroute'" class="flex flex-col gap-2">
        <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase"
          >Passerelle de repli</span
        >
        <input
          v-model="rerouteUrl"
          type="url"
          placeholder="https://..."
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
        <span class="text-xs text-txt-low">Le board refuse toute adresse qui n est pas en https.</span>
      </label>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="busy"
          class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        >
          Enregistrer
        </button>
        <span v-if="saved" class="text-xs text-green">Conduite enregistree</span>
      </div>

      <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ refusal }}</p>
    </form>
  </div>
</template>
