<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type { ProjectCard, StoryHold } from '@/domain/Board/BoardModel'
import { DRAWER_TABS, tabOfState, type DrawerTab } from './DrawerTab'
import ContextGauge from './ContextGauge.vue'
import DeliveryTab from './DeliveryTab.vue'
import DiscussionTab from './DiscussionTab.vue'
import PlanTab from './PlanTab.vue'
import ReviewTab from './ReviewTab.vue'
import SessionActivity from './SessionActivity.vue'
import StoryTab from './StoryTab.vue'
import ThreadTab from './ThreadTab.vue'

const props = defineProps<{ story: ProjectCard; hold: StoryHold | null }>()
const emit = defineEmits<{ close: []; moved: [] }>()

const { t } = useI18n()
const say = usePhrase()
const tab = ref<DrawerTab>('story')
const blockedReason = ref('')
const blocking = ref(false)
const blockRefusal = ref<Phrase | null>(null)

watch(
  () => props.story.id,
  () => {
    tab.value = tabOfState(props.story.state)
    blockedReason.value = ''
    blockRefusal.value = null
  },
  { immediate: true },
)

async function blockStory(): Promise<void> {
  blocking.value = true
  blockRefusal.value = null
  try {
    await board.send(`/api/stories/${props.story.id}/block`, 'POST', {
      reason: blockedReason.value,
    })
    blockedReason.value = ''
    emit('moved')
  } catch (error) {
    blockRefusal.value = reasonOf(error)
  } finally {
    blocking.value = false
  }
}

async function unblockStory(): Promise<void> {
  blocking.value = true
  blockRefusal.value = null
  try {
    await board.send(`/api/stories/${props.story.id}/block`, 'DELETE')
    emit('moved')
  } catch (error) {
    blockRefusal.value = reasonOf(error)
  } finally {
    blocking.value = false
  }
}
</script>

<template>
  <aside
    class="flex w-[420px] flex-none flex-col border-l border-line bg-panel"
    :aria-label="t('kanban.drawerAria')"
  >
    <header class="flex items-start gap-3 border-b border-line px-6 py-4">
      <div class="min-w-0">
        <span class="font-mono text-[11px] font-semibold text-txt-mid">{{ story.reference }}</span>
        <h2 class="display-italic mt-1 text-[22px] leading-tight">{{ story.title }}</h2>
      </div>
      <RouterLink
        :to="`/me/stories/${story.id}`"
        class="ml-auto rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[11px] text-txt-mid uppercase hover:border-acc"
        >{{ t('common.open') }}</RouterLink
      >
      <button
        type="button"
        class="rounded-lg border border-line bg-card px-2.5 py-1.5 font-mono text-[11px] text-txt-mid uppercase hover:border-acc"
        @click="emit('close')"
      >
        {{ t('common.close') }}
      </button>
    </header>

    <div class="flex flex-col gap-1.5 border-b border-line px-6 py-3">
      <div class="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(90px,1fr))]">
        <article v-if="story.points !== null" class="rounded-lg bg-card p-2.5">
          <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
            {{ t('kanban.pointsLabel') }}
          </p>
          <p class="display-italic mt-1 text-[22px]">{{ story.points }}</p>
        </article>
        <article class="rounded-lg bg-card p-2.5">
          <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
            {{ t('kanban.costLabel') }}
          </p>
          <p class="display-italic mt-1 text-[22px]">
            {{ t('common.money', { amount: story.usage.costUsd.toFixed(2) }) }}
          </p>
        </article>
        <article class="rounded-lg bg-card p-2.5">
          <p class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">
            {{ t('kanban.tokensLabel') }}
          </p>
          <p class="display-italic mt-1 text-[22px]">
            {{ story.usage.inputTokens + story.usage.outputTokens }}
          </p>
        </article>
      </div>
      <ContextGauge :context="story.context" />
      <SessionActivity :entries="story.activity" />
      <p v-if="story.mergeConflict" class="font-mono text-[11px] text-red uppercase">
        {{ t('kanban.mergeConflict') }}
      </p>
      <p v-if="hold !== null" class="text-[11px] text-orange">
        <span class="font-mono text-[11px] font-bold uppercase">{{ t('kanban.held') }}</span>
        · {{ hold.reason }}
      </p>
      <p v-if="story.blockers.length > 0" class="text-[11px] text-orange">
        {{ t('kanban.blockedBy') }}
        <span v-for="blocker in story.blockers" :key="blocker" class="ml-1 font-mono text-[11px]">{{
          blocker
        }}</span>
      </p>

      <p v-if="blockRefusal !== null" class="text-[11px] text-red" role="alert">{{ say(blockRefusal) }}</p>

      <div v-if="story.blockedReason !== null" class="flex flex-col gap-1.5 rounded-lg border border-orange bg-orange/10 p-2.5">
        <p class="text-[11px] text-orange">
          <span class="font-mono text-[11px] font-bold uppercase">{{ t('kanban.blockedManually') }}</span>
          · {{ story.blockedReason }}
        </p>
        <button
          type="button"
          :disabled="blocking"
          class="self-start rounded-lg border border-orange bg-card px-2.5 py-1.5 font-mono text-[11px] font-bold text-orange uppercase disabled:opacity-40"
          @click="unblockStory()"
        >
          {{ t('kanban.unblock') }}
        </button>
      </div>
      <form v-else class="flex flex-col gap-1.5" @submit.prevent="blockStory()">
        <label class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase" for="blocked-reason">
          {{ t('kanban.blockReasonLabel') }}
        </label>
        <div class="flex gap-1.5">
          <input
            id="blocked-reason"
            v-model="blockedReason"
            type="text"
            class="min-w-0 flex-1 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] text-txt-hi"
          />
          <button
            type="submit"
            :disabled="blocking || blockedReason.trim() === ''"
            class="flex-none rounded-lg border border-orange bg-card px-2.5 py-1.5 font-mono text-[11px] font-bold text-orange uppercase disabled:opacity-40"
          >
            {{ t('kanban.block') }}
          </button>
        </div>
      </form>
    </div>

    <TabsRoot v-model="tab" as="div" class="contents">
      <TabsList
        as="nav"
        class="flex flex-none gap-0.5 overflow-x-auto border-b border-line px-3"
        :aria-label="t('kanban.tabsAria')"
      >
        <TabsTrigger
          v-for="name in DRAWER_TABS"
          :key="name"
          :value="name"
          class="border-b-[3px] px-4 py-2.5 display-italic text-sm whitespace-nowrap uppercase transition-colors"
          :class="
            name === tab ? 'border-acc text-txt-hi' : 'border-transparent text-txt-low hover:text-txt-hi'
          "
        >
          {{ t(`drawerTab.${name}`) }}
        </TabsTrigger>
      </TabsList>

      <div class="min-h-0 flex-1 overflow-auto p-6">
        <TabsContent value="thread">
          <ThreadTab :story="story" @moved="emit('moved')" />
        </TabsContent>
        <TabsContent value="story">
          <StoryTab :story="story" />
        </TabsContent>
        <TabsContent value="plan">
          <PlanTab :story="story" @moved="emit('moved')" />
        </TabsContent>
        <TabsContent value="review">
          <ReviewTab :story="story" @moved="emit('moved')" />
        </TabsContent>
        <TabsContent value="delivery">
          <DeliveryTab :story="story" @moved="emit('moved')" />
        </TabsContent>
        <TabsContent value="discussion">
          <DiscussionTab :story="story" @freed="emit('moved')" />
        </TabsContent>
      </div>
    </TabsRoot>
  </aside>
</template>
