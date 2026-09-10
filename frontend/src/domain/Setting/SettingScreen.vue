<script setup lang="ts">
import AccountSection from './AccountSection.vue'
import AppearanceSection from './AppearanceSection.vue'
import BudgetSection from './BudgetSection.vue'
</script>

<template>
  <div class="flex max-w-3xl flex-col gap-6 p-8">
    <AppearanceSection />
    <AccountSection />
    <BudgetSection />
  </div>
</template>
