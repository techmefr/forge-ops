<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <p class="m-0 text-xs text-txt-low">
    <span class="text-red" aria-hidden="true">*</span> {{ t('common.requiredNote') }}
  </p>
</template>
