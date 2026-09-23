<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import FileScreen from '@/domain/File/FileScreen.vue'
import ResourceScreen from '@/domain/Resource/ResourceScreen.vue'
import StoryScreen from '@/domain/Story/StoryScreen.vue'
import ViewScreen from '@/domain/View/ViewScreen.vue'
import PersonalTally from '@/domain/Personal/PersonalTally.vue'
import ProjectEmptyState from '@/domain/Board/ProjectEmptyState.vue'
import ScreenTabs from './ScreenTabs.vue'
import {
  PERSONAL_BASE,
  PERSONAL_TABS,
  tabOfRoute,
} from '@/technical/Router/ScreenTab'
import type { Project } from '@/domain/Board/BoardModel'

const route = useRoute()
const current = computed(() => tabOfRoute(PERSONAL_TABS, route.params.tab))

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const hasNoProject = computed(
  () =>
    projects.data.value !== null &&
    projects.failure.value === null &&
    projects.data.value.length === 0,
)

onMounted(() => projects.reload())
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-col">
    <div v-if="hasNoProject" class="p-6" data-tour="project-empty-state">
      <ProjectEmptyState @created="projects.reload()" />
    </div>
    <div data-tour="personal-tally">
      <PersonalTally />
    </div>
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
