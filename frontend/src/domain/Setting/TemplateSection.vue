<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type { ColumnTemplate } from '@/domain/Board/BoardModel'
import EffectBadge from './EffectBadge.vue'

const { t } = useI18n()
const say = usePhrase()

const catalogue = useResource<{ templates: readonly ColumnTemplate[]; defaultTemplate: ColumnTemplate; maySettle: boolean }>(
  () => board.read('/api/templates'),
)
const carried = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const imported = ref(false)

const known = computed(() => catalogue.data.value?.templates ?? [])

async function exportOne(templateId: number): Promise<void> {
  carried.value = (await board.read<{ jsonl: string }>(`/api/templates/${templateId}/jsonl`)).jsonl
}

async function importOne(): Promise<void> {
  busy.value = true
  refusal.value = null
  imported.value = false
  try {
    await board.send('/api/templates/jsonl', 'POST', { jsonl: carried.value })
    imported.value = true
    await catalogue.reload()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

onMounted(() => catalogue.reload())
</script>

<template>
  <section class="flex flex-col gap-4 border-t border-hair pt-6">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('setting.templates') }}</h2>
      <EffectBadge section="templates" />
    </div>

    <p class="text-sm text-txt-low">{{ t('template.whatItControls') }}</p>

    <ul class="flex flex-col gap-2">
      <li
        v-for="template in known"
        :key="template.id"
        class="flex flex-wrap items-center gap-2 text-sm"
      >
        <span class="font-mono text-xs text-txt-hi">{{ template.name }}</span>
        <span class="font-mono text-xs text-txt-low">v{{ template.version }}</span>
        <span v-if="template.isDefault" class="rounded-md px-1.5 py-0.5 text-xs text-acc">{{
          t('template.byDefault')
        }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-sm ml-auto"
          @click="exportOne(template.id)"
        >
          {{ t('template.export') }}
        </button>
      </li>
    </ul>

    <label class="flex flex-col gap-1 text-sm text-txt-mid">
      {{ t('template.jsonl') }}
      <textarea
        v-model="carried"
        rows="6"
        class="field font-mono"
      />
    </label>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="busy || carried.trim() === '' || !(catalogue.data.value?.maySettle ?? false)"
        class="btn btn-primary btn-sm"
        @click="importOne()"
      >
        {{ t('template.import') }}
      </button>
      <span v-if="imported" class="text-xs text-green">{{
        t('template.imported')
      }}</span>
      <span v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</span>
    </div>
  </section>
</template>
