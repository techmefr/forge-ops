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
  <section class="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-[22px]">{{ t('setting.templates') }}</h2>
      <EffectBadge section="templates" />
    </div>

    <p class="text-[13px] text-txt-low">{{ t('template.whatItControls') }}</p>

    <ul class="flex flex-col gap-2">
      <li
        v-for="template in known"
        :key="template.id"
        class="flex flex-wrap items-center gap-2 text-[13px]"
      >
        <span class="font-mono text-[11px] text-txt-hi">{{ template.name }}</span>
        <span class="font-mono text-[11px] text-txt-low">v{{ template.version }}</span>
        <span v-if="template.isDefault" class="rounded-md border border-acc px-1.5 py-0.5 font-mono text-[11px] text-acc uppercase">{{
          t('template.byDefault')
        }}</span>
        <button
          type="button"
          class="ml-auto rounded-lg border border-line px-2 py-1 font-mono text-[11px] text-txt-mid uppercase hover:border-acc"
          @click="exportOne(template.id)"
        >
          {{ t('template.export') }}
        </button>
      </li>
    </ul>

    <label class="flex flex-col gap-1 text-[13px] text-txt-mid">
      {{ t('template.jsonl') }}
      <textarea
        v-model="carried"
        rows="6"
        class="rounded-lg border border-line bg-panel px-2 py-1.5 font-mono text-[11px] text-txt-hi"
      />
    </label>

    <div class="flex flex-wrap items-center gap-3">
      <button
        type="button"
        :disabled="busy || carried.trim() === '' || !(catalogue.data.value?.maySettle ?? false)"
        class="rounded-lg border border-acc bg-acc px-3 py-1.5 font-mono text-[11px] font-bold text-ink uppercase disabled:opacity-40"
        @click="importOne()"
      >
        {{ t('template.import') }}
      </button>
      <span v-if="imported" class="font-mono text-[11px] text-green uppercase">{{
        t('template.imported')
      }}</span>
      <span v-if="refusal !== null" class="text-[11px] text-red" role="alert">{{ say(refusal) }}</span>
    </div>
  </section>
</template>
