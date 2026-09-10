<script setup lang="ts">
import { ref, watch } from 'vue'
import type { KanbanStory } from '@/domain/Board/BoardModel'
import { DRAWER_TABS, DRAWER_TAB_LABELS, tabOfState, type DrawerTab } from './DrawerTab'
import DeliveryTab from './DeliveryTab.vue'
import DiscussionTab from './DiscussionTab.vue'
import PlanTab from './PlanTab.vue'
import ReviewTab from './ReviewTab.vue'
import StoryTab from './StoryTab.vue'

const props = defineProps<{ story: KanbanStory }>()
const emit = defineEmits<{ close: []; moved: [] }>()

const tab = ref<DrawerTab>('story')

watch(
  () => props.story.id,
  () => {
    tab.value = tabOfState(props.story.state)
  },
  { immediate: true },
)
</script>

<template>
  <aside
    class="flex w-[420px] flex-none flex-col border-l border-line bg-panel"
    aria-label="Fiche de la story"
  >
    <header class="flex items-start gap-3 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <span class="font-mono text-[11px] font-semibold text-acc">{{ story.reference }}</span>
        <h2 class="display-italic mt-1 text-lg leading-tight">{{ story.title }}</h2>
      </div>
      <button
        type="button"
        class="ml-auto rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[10px] text-txt-mid uppercase hover:border-acc"
        @click="emit('close')"
      >
        Fermer
      </button>
    </header>

    <nav class="flex flex-none gap-0.5 overflow-x-auto border-b border-line px-3" aria-label="Fiche">
      <button
        v-for="name in DRAWER_TABS"
        :key="name"
        type="button"
        :aria-current="name === tab ? 'page' : undefined"
        class="border-b-[3px] px-3 py-2.5 font-mono text-[10px] font-bold whitespace-nowrap uppercase"
        :class="
          name === tab ? 'border-acc text-txt-hi' : 'border-transparent text-txt-low hover:text-txt-hi'
        "
        @click="tab = name"
      >
        {{ DRAWER_TAB_LABELS[name] }}
      </button>
    </nav>

    <div class="min-h-0 flex-1 overflow-auto p-5">
      <StoryTab v-if="tab === 'story'" :story="story" />
      <PlanTab v-else-if="tab === 'plan'" :story="story" @moved="emit('moved')" />
      <ReviewTab v-else-if="tab === 'review'" :story="story" @moved="emit('moved')" />
      <DeliveryTab v-else-if="tab === 'delivery'" :story="story" @moved="emit('moved')" />
      <DiscussionTab v-else :story="story" @freed="emit('moved')" />
    </div>
  </aside>
</template>
