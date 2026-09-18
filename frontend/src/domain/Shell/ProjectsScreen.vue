<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DeploymentScreen from '@/domain/Deployment/DeploymentScreen.vue'
import KanbanScreen from '@/domain/Kanban/KanbanScreen.vue'
import ScreenTabs from './ScreenTabs.vue'
import {
  PROJECT_BASE,
  PROJECT_TABS,
  tabOfRoute,
} from '@/technical/Router/ScreenTab'

const route = useRoute()
const current = computed(() => tabOfRoute(PROJECT_TABS, route.params.tab))
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <ScreenTabs
      :base="PROJECT_BASE"
      :tabs="PROJECT_TABS"
      :current="current"
      group="projectTab"
    />
    <div class="min-h-0 min-w-0 flex-1 overflow-auto lg:overflow-hidden">
      <KanbanScreen v-if="current === `board`" />
      <DeploymentScreen v-else />
    </div>
  </div>
</template>
