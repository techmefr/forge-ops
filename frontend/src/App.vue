<script setup lang="ts">
import AppShell from '@/domain/Shell/AppShell.vue'
import DemoReadOnlyNotice from '@/domain/Shell/DemoReadOnlyNotice.vue'
import { FROZEN_VISIT } from '@/technical/Api/Visit'
</script>

<template>
  <DemoReadOnlyNotice v-if="FROZEN_VISIT" />
  <AppShell />
</template>
