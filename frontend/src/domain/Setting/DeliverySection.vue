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
  <section class="flex flex-col gap-6 border-t border-hair pt-6">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('setting.delivery') }}</h2>
      <EffectBadge section="delivery" />
    </div>

    <p class="text-sm text-txt-mid">{{ t('grouping.said') }}</p>

    <ChoiceRow
      v-if="settings.data.value?.maySettle"
      :label="t('grouping.label')"
      :hint="t('grouping.hint')"
      :options="options"
      :current="grouping"
      @select="choose"
    />
    <p v-else class="tabular-nums text-xs text-txt-low">
      {{ t('grouping.label') }} · {{ t(`grouping.${grouping}`) }}
    </p>

    <p v-if="refusal !== null" class="text-sm text-red" role="alert">{{ say(refusal) }}</p>
  </section>
</template>
