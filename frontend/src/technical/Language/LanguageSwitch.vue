<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { LANGUAGES, type Language } from './Language'
import { useLanguage } from './UseLanguage'

const { t } = useI18n()
const { language, selectLanguage } = useLanguage()
const fieldId = useId()

function pick(event: Event): void {
  selectLanguage((event.target as HTMLSelectElement).value as Language)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <label :for="fieldId" class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
      {{ t('language.label') }}
    </label>
    <select
      :id="fieldId"
      :value="language"
      class="rounded-lg border border-line bg-card px-2.5 py-1.5 text-xs text-txt-hi"
      @change="pick"
    >
      <option v-for="name in LANGUAGES" :key="name" :value="name">
        {{ t(`language.${name}`) }}
      </option>
    </select>
  </div>
</template>
