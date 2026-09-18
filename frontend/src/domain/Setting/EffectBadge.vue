<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { effectOf } from './SettingSection'

const props = defineProps<{ section: string }>()

const { t } = useI18n()
const effect = computed(() => effectOf(props.section))
</script>

<template>
  <span
    v-if="effect !== null"
    class="rounded-md border px-2 py-0.5 font-mono text-[9.5px] uppercase"
    :class="effect === 'immediate' ? 'border-line text-txt-low' : 'border-orange text-orange'"
    >{{ t(`settingEffect.${effect}`) }}</span
  >
</template>
