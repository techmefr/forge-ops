<script setup lang="ts">
import AccountSection from './AccountSection.vue'
import AppearanceSection from './AppearanceSection.vue'
import BudgetSection from './BudgetSection.vue'
</script>

<template>
  <div class="flex h-full min-h-0 max-w-3xl flex-col gap-6 overflow-auto p-8">
    <AppearanceSection />
    <AccountSection />
    <BudgetSection />
  </div>
</template>
