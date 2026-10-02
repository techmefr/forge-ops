<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import type { ForgeCardView } from '@contract/ForgeCardContract'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { groupThread, replyRouteOf, submitsOn } from './ConversationRule'
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
  move: [stepKey: string]
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
const previous = computed(() => adjacentStep(props.steps, props.card, -1))
const following = computed(() => adjacentStep(props.steps, props.card, 1))
const autoNote = computed(() => {
  const auto = props.card.auto
  if (!auto || auto.state === 'running') {
    return ''
  }
  return t(auto.state === 'red' ? 'autopilot.red' : 'autopilot.paused', { reason: auto.reason ?? '' })
})
const grouped = computed(() => groupThread(conversation.items.value))
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
        class="fixed top-0 right-0 z-50 flex h-dvh w-full flex-col border-l border-hair bg-panel shadow-lg min-[760px]:w-[min(760px,100vw)]"
        data-test="forge-drawer"
      >
        <header class="flex flex-none items-start gap-3 border-b border-line px-6 py-4">
          <div class="min-w-0 flex-1">
            <p class="m-0 font-mono text-xs text-txt-low">{{ referenceLabel(card) }}</p>
            <DialogTitle class="title-face m-0 text-lg text-txt-hi">{{ card.title }}</DialogTitle>
            <DialogDescription class="sr-only">{{ t('forge.drawer.threadAria') }}</DialogDescription>
          </div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-test="forge-open-story"
            @click="openStory"
          >
            {{ t('forge.drawer.openStory') }}
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="emit('close')"
          >
            {{ t('forge.drawer.close') }}
          </button>
        </header>

        <div class="flex-none border-b border-line px-6 py-3 text-sm">
          <p class="m-0 text-txt-hi" data-test="forge-drawer-where">
            {{ [projectName, card.subjectTitle, step?.label].filter((part) => part).join(' · ') }}
          </p>
          <p class="m-0 mt-1 tabular-nums text-txt-mid sm:truncate" data-test="forge-drawer-who">
            <span class="mr-1 inline-block size-2 rounded-full bg-current align-middle" aria-hidden="true" />{{ [agentLine, sessionLine].filter((part) => part !== '').join(' · ') }}
          </p>
        </div>

        <p v-if="autoNote !== ''" class="m-0 flex-none border-b border-hair px-5 py-2 text-xs text-orange" data-test="auto-note">
          {{ autoNote }}
        </p>

        <div class="flex flex-none flex-wrap items-center gap-2 border-b border-hair px-5 py-2">
          <button
            v-if="action !== null"
            type="button"
            class="btn btn-primary btn-sm"
            :disabled="busy"
            data-test="forge-drawer-action"
            @click="emit('act', action)"
          >
            {{ actionLabel }}
          </button>
          <button
            v-if="secondaryAction !== null"
            type="button"
            class="btn btn-ghost btn-sm"
            :disabled="busy"
            data-test="forge-drawer-secondary-action"
            @click="emit('act', secondaryAction)"
          >
            {{ t(`forge.action.${secondaryAction}`) }}
          </button>
          <span class="flex-1" />
          <button
            v-if="previous !== null"
            type="button"
            class="btn btn-ghost btn-sm"
            :disabled="busy"
            data-test="forge-drawer-previous"
            @click="emit('move', previous.key)"
          >
            {{ t('forge.drawer.moveBack', { step: previous.label }) }}
          </button>
          <button
            v-if="following !== null"
            type="button"
            class="btn btn-ghost btn-sm"
            :disabled="busy"
            data-test="forge-drawer-next"
            @click="emit('move', following.key)"
          >
            {{ t('forge.drawer.moveOn', { step: following.label }) }}
          </button>
        </div>

        <details
          v-if="grouped.proofs.length > 0"
          class="flex-none border-b border-hair px-5 py-2 text-xs"
          data-test="forge-proofs"
        >
          <summary class="flex min-h-8 cursor-pointer items-center max-sm:min-h-10 text-txt-mid hover:text-txt-hi">
            {{ t('forge.drawer.proofs', { count: grouped.proofs.length }) }}
          </summary>
          <ul class="m-0 mt-1 flex list-none flex-col gap-1 p-0">
            <li v-for="proof in grouped.proofs" :key="proof.id" class="flex flex-wrap items-baseline gap-x-3">
              <span class="text-txt-hi">{{ proof.body }}</span>
              <span v-if="proof.evidencePath !== null" class="font-mono text-txt-low">{{ proof.evidencePath }}</span>
            </li>
          </ul>
        </details>

        <div
          ref="thread"
          class="min-h-0 flex-1 overflow-y-auto px-5 py-3"
          role="log"
          aria-live="off"
          :aria-label="t('forge.drawer.threadAria')"
          tabindex="0"
        >
          <p
            v-if="grouped.blocks.length === 0 && !conversation.pending.value"
            class="m-0 text-xs text-txt-low"
          >
            {{ t('forge.drawer.empty') }}
          </p>
          <ol class="m-0 flex list-none flex-col gap-3 p-0">
            <li v-for="item in grouped.blocks" :key="item.id">
              <p
                v-if="item.kind === 'marker'"
                class="m-0 flex items-center gap-2 border-t border-hair pt-2 tabular-nums text-xs text-txt-low"
              >
                <span>{{ t(`phase.${item.phase}`) }}</span>
                <span v-if="item.agent !== null">{{ item.agent }}</span>
              </p>
              <div
                v-else-if="item.kind === 'group'"
                class="flex flex-col gap-0.5"
                :class="item.voice === 'human' ? 'items-end' : 'items-start'"
              >
                <p class="m-0 text-xs text-txt-low">
                  {{ item.voice === 'human' && item.author === 'you' ? t('forge.drawer.you') : item.author }}
                </p>
                <div
                  class="flex max-w-[92%] flex-col gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap text-txt-hi"
                  :class="item.voice === 'human' ? 'bg-elev' : 'bg-card'"
                >
                  <p v-for="message in item.messages" :key="message.id" class="m-0">{{ message.body }}</p>
                </div>
              </div>
              <p
                v-else-if="item.kind === 'tool'"
                class="m-0 flex items-center gap-2 font-mono text-xs"
                :class="item.outcome === 'failed' ? 'text-red' : 'text-txt-mid'"
                data-test="forge-tool"
              >
                <span aria-hidden="true">{{ OUTCOME_GLYPH[item.outcome] }}</span>
                <span>{{ t('forge.drawer.tool', { name: item.name === '' ? '·' : item.name }) }}</span>
                <span class="text-txt-low">{{ outcomeLabel(item.outcome) }}</span>
              </p>
              <p v-else class="m-0 text-xs text-red" role="alert">{{ item.text }}</p>
            </li>
          </ol>
          <p
            v-if="working"
            class="m-0 mt-2 flex items-center gap-2 text-xs text-acc"
            data-test="forge-working"
          >
            <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-acc motion-reduce:animate-none" aria-hidden="true" />
            {{ t('forge.drawer.working') }}
          </p>
        </div>

        <p class="sr-only" role="status" aria-live="polite">
          {{ conversation.announcement.value === '' ? '' : t('forge.drawer.announceAgent', { text: conversation.announcement.value }) }}
        </p>

        <form class="flex flex-none flex-col gap-1.5 border-t border-hair px-5 py-3" @submit.prevent="submit">
          <p v-if="conversation.failure.value !== null" class="m-0 text-xs text-red" role="alert">
            {{ say(conversation.failure.value) }}
          </p>
          <label class="text-xs text-txt-low" for="forge-reply">
            {{ route === 'note' ? t('forge.drawer.noteLabel') : t('forge.drawer.replyLabel') }}
          </label>
          <div class="flex items-end gap-2">
            <textarea
              id="forge-reply"
              ref="field"
              v-model="draft"
              rows="2"
              class="field min-h-[3.5rem] min-w-0 flex-1 resize-y"
              :placeholder="route === 'note' ? t('forge.drawer.notePlaceholder') : t('forge.drawer.replyPlaceholder')"
              @keydown="onKey"
            />
            <button
              type="submit"
              class="btn btn-ghost btn-sm"
              :disabled="conversation.sending.value || draft.trim() === ''"
            >
              {{ route === 'note' ? t('forge.drawer.sendNote') : t('forge.drawer.send') }}
            </button>
          </div>
          <small class="text-xs text-txt-low">{{ t('forge.drawer.hint') }}</small>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
