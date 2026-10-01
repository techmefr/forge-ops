<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { replyRouteOf, submitsOn } from './ConversationRule'
import { STATUS_GLYPH } from './ForgeGlyph'
import { adjacentStep, minutesOf, primaryActionOf, referenceLabel, secondaryActionOf, type BoardStep, type CardAction } from './ForgeRule'
import { useCardConversation } from './UseCardConversation'

const props = defineProps<{
  card: ForgeCardView
  steps: readonly BoardStep[]
  projectName: string
  busy: boolean
}>()

const emit = defineEmits<{
  close: []
  act: [action: CardAction]
  settled: []
}>()

const { t } = useI18n()
const say = usePhrase()
const router = useRouter()

const conversation = useCardConversation(
  { id: props.card.storyId, reference: props.card.storyReference },
  { onSettled: () => emit('settled') },
)

function openStory(): void {
  void router?.push(`/me/stories/${props.card.storyId}`)
}

const draft = ref('')
const thread = ref<HTMLElement | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)

const step = computed(() => props.steps.find((candidate) => candidate.key === props.card.stepKey) ?? null)
const route = computed(() => replyRouteOf(step.value?.kind ?? 'backlog', step.value?.human ?? false))
const action = computed(() => primaryActionOf(props.card, props.steps))
const secondaryAction = computed(() => secondaryActionOf(props.card))
const working = computed(() => props.card.status === 'running')

const agentLine = computed(() => {
  const current = step.value
  if (current === null || current.kind === 'backlog') {
    return t('forge.drawer.backlogAgent')
  }
  if (current.human) {
    return t('forge.drawer.humanAgent')
  }
  const column = current.column
  if (column === null) {
    return ''
  }
  return [column.provider, column.model, column.effort, column.command]
    .filter((part) => part !== '')
    .join(' · ')
})

const sessionLine = computed(() => {
  if (props.card.claudeSessionId === null && props.card.durationSeconds === 0) {
    return t('forge.drawer.noSession')
  }
  return [
    t(`forge.status.${props.card.status}`),
    t('forge.minutes', { count: minutesOf(props.card.durationSeconds) }),
    t('forge.money', { amount: props.card.costUsd.toFixed(2) }),
  ].join(' · ')
})

const actionLabel = computed(() => {
  if (action.value === null) {
    return ''
  }
  const next = adjacentStep(props.steps, props.card, 1)
  return action.value === 'validate' && next !== null
    ? t('forge.action.validateTo', { step: next.label })
    : t(`forge.action.${action.value}`)
})

function outcomeLabel(outcome: 'started' | 'ok' | 'failed'): string {
  if (outcome === 'ok') {
    return t('forge.drawer.toolOk')
  }
  return outcome === 'failed' ? t('forge.drawer.toolFailed') : t('forge.drawer.toolStarted')
}

const OUTCOME_GLYPH: Readonly<Record<'started' | 'ok' | 'failed', string>> = {
  started: '…',
  ok: '✓',
  failed: '✗',
}

async function submit(): Promise<void> {
  const sent = await conversation.send(draft.value, route.value)
  if (sent) {
    draft.value = ''
    await nextTick()
    field.value?.focus()
  }
}

function onKey(event: KeyboardEvent): void {
  if (submitsOn(event.key, event.shiftKey, event.isComposing)) {
    event.preventDefault()
    void submit()
  }
}

function closeWhenClosed(open: boolean): void {
  if (!open) {
    emit('close')
  }
}

watch(
  () => conversation.items.value.length,
  async () => {
    await nextTick()
    if (thread.value !== null) {
      thread.value.scrollTop = thread.value.scrollHeight
    }
  },
)

onMounted(() => void conversation.load())
</script>

<template>
  <DialogRoot :open="true" @update:open="closeWhenClosed">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-deep/70" />
      <DialogContent
        class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-line bg-panel min-[760px]:w-[min(760px,100vw)]"
        data-test="forge-drawer"
      >
        <header class="flex flex-none items-start gap-3 border-b border-line px-5 py-3">
          <div class="min-w-0 flex-1">
            <p class="m-0 font-mono text-[11px] text-txt-low">{{ referenceLabel(card) }}</p>
            <DialogTitle class="m-0 text-[13px] font-semibold text-txt-hi">{{ card.title }}</DialogTitle>
            <DialogDescription class="sr-only">{{ t('forge.drawer.threadAria') }}</DialogDescription>
          </div>
          <button
            type="button"
            class="rounded-md border border-line bg-transparent px-2.5 py-1 font-mono text-[11px] text-txt-mid hover:bg-elev"
            data-test="forge-open-story"
            @click="openStory"
          >
            {{ t('forge.drawer.openStory') }}
          </button>
          <button
            type="button"
            class="rounded-md border border-line bg-transparent px-2.5 py-1 font-mono text-[11px] text-txt-mid hover:bg-elev"
            @click="emit('close')"
          >
            {{ t('forge.drawer.close') }}
          </button>
        </header>

        <dl class="m-0 grid flex-none grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-line px-5 py-3 text-[11px]">
          <dt class="text-txt-low">{{ t('forge.drawer.project') }}</dt>
          <dd class="m-0 text-txt-hi">{{ projectName }}</dd>
          <dt class="text-txt-low">{{ t('forge.drawer.subject') }}</dt>
          <dd class="m-0 truncate text-txt-hi">{{ card.subjectTitle }}</dd>
          <dt class="text-txt-low">{{ t('forge.drawer.step') }}</dt>
          <dd class="m-0 text-txt-hi">{{ step?.label }}</dd>
          <dt class="text-txt-low">{{ t('forge.drawer.agent') }}</dt>
          <dd class="m-0 min-w-0 truncate font-mono text-txt-mid">{{ agentLine }}</dd>
          <dt class="text-txt-low">{{ t('forge.drawer.session') }}</dt>
          <dd class="m-0 font-mono text-txt-mid">
            <span aria-hidden="true">{{ STATUS_GLYPH[card.status] }} </span>{{ sessionLine }}
          </dd>
        </dl>

        <div
          v-if="action !== null || secondaryAction !== null"
          class="flex flex-none items-center gap-2 border-b border-line px-5 py-2"
        >
          <button
            v-if="action !== null"
            type="button"
            class="rounded-md border border-line bg-transparent px-3 py-1.5 font-mono text-[11px] text-txt-hi hover:bg-elev disabled:opacity-40"
            :disabled="busy"
            data-test="forge-drawer-action"
            @click="emit('act', action)"
          >
            {{ actionLabel }}
          </button>
          <button
            v-if="secondaryAction !== null"
            type="button"
            class="rounded-md border border-line bg-transparent px-3 py-1.5 font-mono text-[11px] text-txt-mid hover:bg-elev disabled:opacity-40"
            :disabled="busy"
            data-test="forge-drawer-secondary-action"
            @click="emit('act', secondaryAction)"
          >
            {{ t(`forge.action.${secondaryAction}`) }}
          </button>
        </div>

        <div
          ref="thread"
          class="min-h-0 flex-1 overflow-y-auto px-5 py-3"
          role="log"
          aria-live="off"
          :aria-label="t('forge.drawer.threadAria')"
          tabindex="0"
        >
          <p
            v-if="conversation.items.value.length === 0 && !conversation.pending.value"
            class="m-0 text-[11px] text-txt-low"
          >
            {{ t('forge.drawer.empty') }}
          </p>
          <ol class="m-0 flex list-none flex-col gap-2 p-0">
            <li v-for="item in conversation.items.value" :key="item.id">
              <p
                v-if="item.kind === 'marker'"
                class="m-0 flex items-center gap-2 border-t border-line pt-2 font-mono text-[11px] text-txt-low"
              >
                <span>{{ t(`phase.${item.phase}`) }}</span>
                <span v-if="item.agent !== null">{{ item.agent }}</span>
              </p>
              <div
                v-else-if="item.kind === 'message'"
                class="flex flex-col gap-0.5"
                :class="item.voice === 'human' ? 'items-end' : 'items-start'"
              >
                <p class="m-0 flex items-center gap-2 text-[11px] text-txt-low">
                  <span>{{ item.voice === 'human' && item.author === 'you' ? t('forge.drawer.you') : item.author }}</span>
                  <span v-if="item.proof" class="rounded-md border border-line px-1.5 font-mono">{{
                    t('forge.drawer.proof')
                  }}</span>
                </p>
                <p
                  class="m-0 max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-txt-hi"
                  :class="item.voice === 'human' ? 'bg-elev' : 'bg-card'"
                >
                  {{ item.body }}
                </p>
                <p v-if="item.evidencePath !== null" class="m-0 font-mono text-[11px] text-txt-low">
                  {{ item.evidencePath }}
                </p>
              </div>
              <p
                v-else-if="item.kind === 'tool'"
                class="m-0 flex items-center gap-2 font-mono text-[11px]"
                :class="item.outcome === 'failed' ? 'text-red' : 'text-txt-mid'"
                data-test="forge-tool"
              >
                <span aria-hidden="true">{{ OUTCOME_GLYPH[item.outcome] }}</span>
                <span>{{ t('forge.drawer.tool', { name: item.name === '' ? '·' : item.name }) }}</span>
                <span class="text-txt-low">{{ outcomeLabel(item.outcome) }}</span>
              </p>
              <p v-else class="m-0 text-[11px] text-red" role="alert">{{ item.text }}</p>
            </li>
          </ol>
          <p
            v-if="working"
            class="m-0 mt-2 flex items-center gap-2 text-[11px] text-acc"
            data-test="forge-working"
          >
            <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-acc motion-reduce:animate-none" aria-hidden="true" />
            {{ t('forge.drawer.working') }}
          </p>
        </div>

        <p class="sr-only" role="status" aria-live="polite">
          {{ conversation.announcement.value === '' ? '' : t('forge.drawer.announceAgent', { text: conversation.announcement.value }) }}
        </p>

        <form class="flex flex-none flex-col gap-1.5 border-t border-line px-5 py-3" @submit.prevent="submit">
          <p v-if="conversation.failure.value !== null" class="m-0 text-[11px] text-red" role="alert">
            {{ say(conversation.failure.value) }}
          </p>
          <label class="text-[11px] text-txt-low" for="forge-reply">
            {{ route === 'note' ? t('forge.drawer.noteLabel') : t('forge.drawer.replyLabel') }}
          </label>
          <div class="flex items-end gap-2">
            <textarea
              id="forge-reply"
              ref="field"
              v-model="draft"
              rows="2"
              class="min-h-[3.5rem] min-w-0 flex-1 resize-y rounded-md border border-line bg-card px-2.5 py-1.5 text-sm text-txt-hi"
              :placeholder="route === 'note' ? t('forge.drawer.notePlaceholder') : t('forge.drawer.replyPlaceholder')"
              @keydown="onKey"
            />
            <button
              type="submit"
              class="rounded-md border border-line bg-transparent px-3 py-1.5 font-mono text-[11px] text-txt-hi hover:bg-elev disabled:opacity-40"
              :disabled="conversation.sending.value || draft.trim() === ''"
            >
              {{ route === 'note' ? t('forge.drawer.sendNote') : t('forge.drawer.send') }}
            </button>
          </div>
          <small class="text-[11px] text-txt-low">{{ t('forge.drawer.hint') }}</small>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
