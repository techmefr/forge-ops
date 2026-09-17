<script setup lang="ts">
import AppShell from '@/domain/Shell/AppShell.vue'
import FrozenVisitBanner from '@/domain/Shell/FrozenVisitBanner.vue'
import { FROZEN_VISIT } from '@/technical/Api/Visit'
</script>

<template>
  <FrozenVisitBanner v-if="FROZEN_VISIT" />
  <AppShell />
</template>
