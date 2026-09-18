<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ChoiceRow from './ChoiceRow.vue'
import EffectBadge from './EffectBadge.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import { GROUPING_MODES, type GroupingMode } from '@contract/DeliveryContract'

const { t } = useI18n()
const say = usePhrase()

const settings = useResource<{ grouping: GroupingMode; maySettle: boolean }>(() =>
  board.read('/api/delivery/grouping'),
)
const refusal = ref<Phrase | null>(null)

const grouping = computed<GroupingMode>(() => settings.data.value?.grouping ?? 'single')
const options = computed(() =>
  GROUPING_MODES.map((mode) => ({ key: mode, label: t(`grouping.${mode}`) })),
)

async function choose(mode: GroupingMode): Promise<void> {
  refusal.value = null
  try {
    await board.send('/api/delivery/grouping', 'POST', { grouping: mode })
    await settings.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  }
}

void settings.reload()
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl border border-line bg-card p-5">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-xl">{{ t('setting.delivery') }}</h2>
      <EffectBadge section="delivery" />
    </div>

    <p class="text-[13px] text-txt-mid">{{ t('grouping.said') }}</p>

    <ChoiceRow
      v-if="settings.data.value?.maySettle"
      :label="t('grouping.label')"
      :hint="t('grouping.hint')"
      :options="options"
      :current="grouping"
      @select="choose"
    />
    <p v-else class="font-mono text-[11px] text-txt-low">
      {{ t('grouping.label') }} · {{ t(`grouping.${grouping}`) }}
    </p>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>
  </section>
</template>
