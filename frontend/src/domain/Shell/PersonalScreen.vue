<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FileScreen from '@/domain/File/FileScreen.vue'
import ResourceScreen from '@/domain/Resource/ResourceScreen.vue'
import StoryScreen from '@/domain/Story/StoryScreen.vue'
import ViewScreen from '@/domain/View/ViewScreen.vue'
import ScreenTabs from './ScreenTabs.vue'
import {
  PERSONAL_BASE,
  PERSONAL_TABS,
  tabOfRoute,
} from '@/technical/Router/ScreenTab'

const route = useRoute()
const current = computed(() => tabOfRoute(PERSONAL_TABS, route.params.tab))
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <ScreenTabs
      :base="PERSONAL_BASE"
      :tabs="PERSONAL_TABS"
      :current="current"
      group="personalTab"
    />
    <div class="min-h-0 min-w-0 flex-1 overflow-auto lg:overflow-hidden">
      <StoryScreen v-if="current === `stories`" />
      <FileScreen v-else-if="current === `files`" />
      <ViewScreen v-else-if="current === `view`" />
      <ResourceScreen v-else />
    </div>
  </div>
</template>
