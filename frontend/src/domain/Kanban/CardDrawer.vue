<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectCard, StoryHold } from '@/domain/Board/BoardModel'
import { DRAWER_TABS, tabOfState, type DrawerTab } from './DrawerTab'
import DeliveryTab from './DeliveryTab.vue'
import DiscussionTab from './DiscussionTab.vue'
import PlanTab from './PlanTab.vue'
import ReviewTab from './ReviewTab.vue'
import StoryTab from './StoryTab.vue'
import ThreadTab from './ThreadTab.vue'

const props = defineProps<{ story: ProjectCard; hold: StoryHold | null }>()
const emit = defineEmits<{ close: []; moved: [] }>()

const { t } = useI18n()
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
    :aria-label="t('kanban.drawerAria')"
  >
    <header class="flex items-start gap-3 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <span class="font-mono text-[11px] font-semibold text-acc">{{ story.reference }}</span>
        <h2 class="display-italic mt-1 text-lg leading-tight">{{ story.title }}</h2>
      </div>
      <RouterLink
        :to="`/me/stories/${story.id}`"
        class="ml-auto rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[10px] text-txt-mid uppercase hover:border-acc"
        >{{ t('common.open') }}</RouterLink
      >
      <button
        type="button"
        class="rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[10px] text-txt-mid uppercase hover:border-acc"
        @click="emit('close')"
      >
        {{ t('common.close') }}
      </button>
    </header>

    <div class="flex flex-col gap-1.5 border-b border-line px-5 py-3">
      <p class="flex flex-wrap items-center gap-x-3 font-mono text-[10px] text-txt-low">
        <span v-if="story.points !== null">{{
          t('kanban.points', { count: story.points }, story.points)
        }}</span>
        <span>{{ t('common.money', { amount: story.usage.costUsd.toFixed(2) }) }}</span>
        <span>{{
          t(
            'kanban.tokens',
            { count: story.usage.inputTokens + story.usage.outputTokens },
            story.usage.inputTokens + story.usage.outputTokens,
          )
        }}</span>
      </p>
      <p v-if="story.mergeConflict" class="font-mono text-[10px] text-red uppercase">
        {{ t('kanban.mergeConflict') }}
      </p>
      <p v-if="hold !== null" class="text-[11px] text-orange">
        <span class="font-mono text-[10px] font-bold uppercase">{{ t('kanban.held') }}</span>
        · {{ hold.reason }}
      </p>
      <p v-if="story.blockers.length > 0" class="text-[11px] text-orange">
        {{ t('kanban.blockedBy') }}
        <span v-for="blocker in story.blockers" :key="blocker" class="ml-1 font-mono text-[10px]">{{
          blocker
        }}</span>
      </p>
    </div>

    <nav
      class="flex flex-none gap-0.5 overflow-x-auto border-b border-line px-3"
      :aria-label="t('kanban.tabsAria')"
    >
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
        {{ t(`drawerTab.${name}`) }}
      </button>
    </nav>

    <div class="min-h-0 flex-1 overflow-auto p-5">
      <ThreadTab v-if="tab === 'thread'" :story="story" @moved="emit('moved')" />
      <StoryTab v-else-if="tab === 'story'" :story="story" />
      <PlanTab v-else-if="tab === 'plan'" :story="story" @moved="emit('moved')" />
      <ReviewTab v-else-if="tab === 'review'" :story="story" @moved="emit('moved')" />
      <DeliveryTab v-else-if="tab === 'delivery'" :story="story" @moved="emit('moved')" />
      <DiscussionTab v-else :story="story" @freed="emit('moved')" />
    </div>
  </aside>
</template>
