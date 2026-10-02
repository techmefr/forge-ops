<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EffectBadge from './EffectBadge.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import {
  COST_CAP_CONDUCT_SEQUENCE,
  type BudgetPolicy,
  type BudgetSettings,
} from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const settings = useResource<BudgetSettings>(() => board.read('/api/settings/budget'))
const draft = ref<BudgetPolicy>({
  capUsd: 20,
  conduct: 'stop',
  downgradeModel: 'claude-haiku-4-5-20251001',
  rerouteBaseUrl: null,
})
const rerouteUrl = ref('')
const refusal = ref<Phrase | null>(null)
const saved = ref(false)
const busy = ref(false)

const maySettle = computed(() => settings.data.value?.maySettle !== false)
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
  <section class="flex flex-col gap-6 border-t border-line pt-6">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('setting.budget') }}</h2>
      <EffectBadge section="budget" />
    </div>
    <div class="rounded-md bg-panel p-4">
      <p class="text-xs text-txt-low">
        {{ t('setting.spentToday') }}
      </p>
      <p class="mt-1 text-xl font-medium">
        {{ t('common.money', { amount: spent.toFixed(2) }) }}
        <span class="text-txt-low">/ {{ t('common.money', { amount: draft.capUsd.toFixed(2) }) }}</span>
      </p>
      <div class="mt-3 h-2 rounded bg-elev">
        <div
          class="h-full rounded"
          :class="usedPercent >= 100 ? 'bg-red' : 'bg-acc'"
          :style="{ width: `${usedPercent}%` }"
        />
      </div>
    </div>

    <form v-if="maySettle" class="flex flex-col gap-6" @submit.prevent="save">
      <label class="flex flex-col gap-2">
        <span class="text-xs text-txt-low">{{
          t('setting.dailyCap')
        }}</span>
        <input
          v-model.number="draft.capUsd"
          type="number"
          min="0.01"
          step="0.01"
          class="w-40 rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
        />
      </label>

      <fieldset class="flex flex-col gap-3 border-0 p-0">
        <legend class="text-xs text-txt-low">
          {{ t('setting.whenCapFalls') }}
        </legend>
        <label
          v-for="conduct in COST_CAP_CONDUCT_SEQUENCE"
          :key="conduct"
          class="flex cursor-pointer gap-3 rounded-md border p-3"
          :class="draft.conduct === conduct ? 'border-acc bg-acc-soft/10' : 'border-line bg-card'"
        >
          <input v-model="draft.conduct" type="radio" :value="conduct" class="mt-1" />
          <span>
            <span class="title-face block text-sm">{{ t(`conduct.${conduct}.label`) }}</span>
            <span class="mt-1 block text-sm text-txt-mid">{{
              t(`conduct.${conduct}.explanation`)
            }}</span>
          </span>
        </label>
      </fieldset>

      <label v-if="draft.conduct === 'downgrade'" class="flex flex-col gap-2">
        <span class="text-xs text-txt-low">{{
          t('setting.fallbackModel')
        }}</span>
        <input
          v-model="draft.downgradeModel"
          type="text"
          class="rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
        />
      </label>

      <label v-if="draft.conduct === 'reroute'" class="flex flex-col gap-2">
        <span class="text-xs text-txt-low">{{
          t('setting.fallbackGateway')
        }}</span>
        <input
          v-model="rerouteUrl"
          type="url"
          :placeholder="t('setting.gatewayPlaceholder')"
          class="rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
        />
        <span class="text-sm text-txt-low">{{ t('setting.httpsOnly') }}</span>
      </label>

      <div class="flex items-center gap-3">
        <button
          type="submit"
          :disabled="busy"
          class="rounded-md border border-acc bg-acc px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          {{ t('common.save') }}
        </button>
        <span v-if="saved" class="text-sm text-green">{{ t('setting.conductSaved') }}</span>
      </div>

      <p v-if="refusal !== null" class="text-sm text-red" role="alert">{{ say(refusal) }}</p>
    </form>
  </section>
</template>
