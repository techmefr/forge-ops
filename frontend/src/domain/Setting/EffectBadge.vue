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
    class="text-xs"
    :class="effect === 'immediate' ? 'text-txt-low' : 'text-orange'"
    >{{ t(`settingEffect.${effect}`) }}</span
  >
</template>
