<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type { EpicOverview, Project, Story } from '@/domain/Board/BoardModel'
import EpicBoard from './EpicBoard.vue'
import { useTranscript } from '@/domain/Session/UseTranscript'
import { useTicket } from './UseTicket'
import StoryTicket from './StoryTicket.vue'
import { PARTS, bothPartsWritten, type StoryPart } from './StoryPart'
import { storiesOfEpic } from './Batch'
import { requestFor, type TicketPoint } from './TicketRequest'
import { provisionalTitle } from './Slice'
import IncidentScreen from '@/domain/Incident/IncidentScreen.vue'
import { DESKS, type Desk } from './Desk'
import type { Incident, KanbanStory } from '@/domain/Board/BoardModel'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const say = usePhrase()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const queue = ref<readonly number[]>([])
const queueEpics = ref<readonly EpicOverview[]>([])
const written = ref<readonly Story[]>([])

const { ticket, open, write, writeTwin, sendToBacklog, dispatch, talk, hangUp } = useTicket()

const reference = computed(() => ticket.data.value?.functional.reference ?? null)
const transcript = useTranscript(reference)
const said = computed(() => transcript.visible())

const turn = ref('')
const part = ref<StoryPart>('functional')
const twinTitle = ref('')
const twinBody = ref('')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)

const desk = ref<Desk>('write')
const running = useResource<readonly KanbanStory[]>(() => board.read('/api/board/kanban'))
const blockingStoryId = ref<number | null>(null)
const others = computed(() =>
  (running.data.value ?? []).filter((story) => story.id !== openId.value),
)
const pending = useResource<readonly Incident[]>(() => board.read('/api/incidents?state=pending'))
const reported = computed(() => (pending.data.value ?? []).length)

const listing = computed(() => queue.value.length === 0 && ticket.data.value === null)
const openId = computed(() => ticket.data.value?.functional.id ?? null)
const storiesOf = computed(() => (epicId: number) => storiesOfEpic(written.value, epicId))
const complete = computed(() => bothPartsWritten(ticket.data.value))

async function startQueue(chosen: readonly number[]): Promise<void> {
  const found = await Promise.all(
    (projects.data.value ?? []).map((project) =>
      board.read<readonly EpicOverview[]>(`/api/projects/${project.id}/epics`),
    ),
  )
  queueEpics.value = found.flat().filter((epic) => chosen.includes(epic.id))
  written.value = []
  queue.value = chosen
  for (const epic of queueEpics.value) {
    await newStory(epic)
  }
}

function leaveQueue(): void {
  queue.value = []
  queueEpics.value = []
  written.value = []
}

async function backToEpics(): Promise<void> {
  const talking = written.value.map((story) => story.id)
  leaveQueue()
  await router.push('/atelier')
  ticket.data.value = null
  await Promise.all(talking.map((storyId) => hangUp(storyId).catch(() => undefined)))
}

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function newStory(epic: EpicOverview): Promise<void> {
  return guard(async () => {
    transcript.clear()
    const story = await write({
      epicId: epic.id,
      title: say(provisionalTitle(storiesOfEpic(written.value, epic.id).length)),
      body: epic.businessIntent,
    })
    written.value = [...written.value, story]
    await router.push(`/atelier/${story.id}`)
    await dispatch(story.id, 'spec')
  })
}

function openWritten(storyId: number): Promise<void> {
  return guard(async () => {
    transcript.clear()
    await open(storyId)
    await router.push(`/atelier/${storyId}`)
  })
}

function sendTurn(): Promise<void> {
  const storyId = ticket.data.value?.functional.id
  if (storyId === undefined || turn.value.trim() === '') {
    return Promise.resolve()
  }
  return guard(async () => {
    await talk(storyId, turn.value)
    turn.value = ''
  })
}

function linkBlocker(): Promise<void> {
  const storyId = openId.value
  const blocking = blockingStoryId.value
  if (storyId === null || blocking === null) {
    return Promise.resolve()
  }
  return guard(async () => {
    await board.send(`/api/stories/${storyId}/dependencies`, 'POST', { blockingStoryId: blocking })
    blockingStoryId.value = null
    await Promise.all([open(storyId), running.reload()])
  })
}

function askClaude(point: TicketPoint): void {
  turn.value = say(requestFor(point))
}

async function submitTwin(): Promise<void> {
  const storyId = ticket.data.value?.functional.id
  if (storyId === undefined) {
    return
  }
  await guard(async () => {
    await writeTwin(storyId, { title: twinTitle.value, body: twinBody.value })
    twinTitle.value = ''
    twinBody.value = ''
  })
}

function toBacklog(): Promise<void> {
  const storyId = ticket.data.value?.functional.id
  return storyId === undefined
    ? Promise.resolve()
    : guard(async () => {
        await sendToBacklog(storyId)
        await hangUp(storyId)
      })
}

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === 'string' && id !== '') {
      void open(Number(id))
    }
  },
)

onMounted(async () => {
  await Promise.all([projects.reload(), pending.reload(), running.reload()])

  const id = route.params.id
  if (typeof id === 'string' && id !== '') {
    await open(Number(id))
  }
})
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
  <nav class="flex flex-none gap-0.5 border-b border-line px-6" :aria-label="t('story.deskNav')">
    <button
      v-for="bench in DESKS"
      :key="bench"
      type="button"
      :aria-current="bench === desk ? 'page' : undefined"
      class="max-w-[22rem] border-b-[3px] px-3 py-2 text-left"
      :class="
        bench === desk ? 'border-acc text-txt-hi' : 'border-transparent text-txt-low hover:text-txt-hi'
      "
      @click="desk = bench"
    >
      <span class="block font-mono text-[10px] font-bold uppercase">
        {{ t(`desk.${bench}.label`) }}
        <span v-if="bench === 'reports' && reported > 0" class="ml-1 text-acc">{{ reported }}</span>
      </span>
      <span class="mt-0.5 block text-[11px] leading-snug text-txt-low normal-case">{{
        t(`desk.${bench}.said`)
      }}</span>
    </button>
  </nav>

  <IncidentScreen v-if="desk === 'reports'" />

  <EpicBoard v-else-if="listing" @chosen="startQueue" />

  <div
    v-else
    class="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:h-full lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,400px)] lg:overflow-hidden"
  >
    <section class="min-h-0 border-b border-line p-5 lg:overflow-auto lg:border-r lg:border-b-0">
      <button
        type="button"
        class="rounded-lg border border-line bg-card px-3 py-2 font-mono text-[10px] font-bold text-txt-mid uppercase hover:border-acc"
        @click="backToEpics()"
      >
        {{ t('story.backToEpics') }}
      </button>

      <template v-if="queue.length > 0">
        <h2 class="display-italic mt-6 text-sm text-txt-mid">{{ t('story.batch') }}</h2>
        <p class="mt-1 text-[11px] text-txt-low">{{ t('story.batchHint') }}</p>

        <div v-for="epic in queueEpics" :key="epic.id" class="mt-4">
          <p class="font-mono text-[10px] tracking-[0.16em] text-acc uppercase">{{ epic.title }}</p>

          <ol class="mt-1.5 flex flex-col gap-1">
            <li v-for="story in storiesOf(epic.id)" :key="story.id">
              <button
                type="button"
                :disabled="busy"
                :aria-current="story.id === openId ? 'true' : undefined"
                class="w-full rounded-lg border px-3 py-2 text-left text-xs disabled:opacity-40"
                :class="
                  story.id === openId
                    ? 'border-acc bg-card text-txt-hi'
                    : 'border-line bg-card text-txt-low hover:border-acc'
                "
                @click="openWritten(story.id)"
              >
                <span class="font-mono text-[10px] text-txt-low">{{ story.reference }}</span>
                <span class="mt-0.5 block">{{ story.title }}</span>
              </button>
            </li>
          </ol>

          <button
            type="button"
            :disabled="busy"
            class="mt-1.5 w-full rounded-lg border border-dashed border-line px-3 py-2 font-mono text-[10px] text-txt-mid uppercase hover:border-acc disabled:opacity-40"
            @click="newStory(epic)"
          >
            {{ storiesOf(epic.id).length === 0 ? t('story.firstStory') : t('story.oneMoreStory') }}
          </button>
        </div>
      </template>
    </section>

    <section class="flex min-h-0 min-w-0 flex-col border-b border-line p-6 lg:border-r lg:border-b-0">
      <h2 class="display-italic text-lg">{{ t('story.writeWithClaude') }}</h2>
      <p class="mt-1 text-xs text-txt-low">{{ t('story.writeWithClaudeHint') }}</p>

      <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ say(refusal) }}</p>

      <p v-if="transcript.broken.value" class="mt-3 text-xs text-orange">
        {{ t('story.streamBroken') }}
      </p>
      <p v-else-if="said.length === 0" class="mt-3 text-xs text-txt-low">
        {{ t('story.batchStarting') }}
      </p>

      <div class="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        <article
          v-for="(utterance, index) in said"
          :key="index"
          class="rounded-xl border p-3"
          :class="
            utterance.name === 'session.human'
              ? 'ml-8 border-acc bg-acc-soft/10'
              : 'mr-8 border-line bg-card'
          "
        >
          <p class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">
            {{ utterance.name === 'session.human' ? t('story.you') : t('story.claude') }}
            <span v-if="utterance.phase !== null"> · {{ t(`phase.${utterance.phase}`) }}</span>
          </p>
          <p
            v-if="utterance.text !== null || utterance.textKey !== null"
            class="mt-1.5 text-sm whitespace-pre-wrap text-txt-hi"
          >
            {{ utterance.text ?? t(utterance.textKey ?? '') }}
          </p>
          <p v-if="utterance.costUsd !== null" class="mt-1.5 font-mono text-[11px] text-acc">
            {{ t('common.money', { amount: utterance.costUsd.toFixed(4) }) }}
          </p>
        </article>
      </div>

      <form class="mt-3 flex flex-none gap-2" @submit.prevent="sendTurn">
        <textarea
          v-model="turn"
          rows="2"
          :placeholder="t('story.turnPlaceholder')"
          class="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        ></textarea>
        <button
          type="submit"
          :disabled="busy || turn.trim() === '' || ticket.data.value === null"
          class="flex-none self-end rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ t('common.send') }}
        </button>
      </form>

      <p v-if="ticket.data.value !== null && !complete" class="mt-3 text-xs text-orange">
        {{ t('story.bothPartsFirst') }}
      </p>

      <div class="mt-3 flex flex-none flex-wrap gap-2">
        <button
          type="button"
          :disabled="busy || !complete"
          class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
          @click="toBacklog()"
        >
          {{ t('story.sendToStore') }}
        </button>
        <button
          v-if="queue.length > 0"
          type="button"
          :disabled="busy"
          class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
          @click="backToEpics()"
        >
          {{ t('story.finishBatch') }}
        </button>
      </div>
    </section>

    <section class="flex min-h-0 min-w-0 flex-col p-6">
      <nav class="flex flex-none gap-0.5 border-b border-line" :aria-label="t('story.partsNav')">
        <button
          v-for="name in PARTS"
          :key="name"
          type="button"
          :aria-current="name === part ? 'page' : undefined"
          class="border-b-[3px] px-3 py-2.5 font-mono text-[10px] font-bold whitespace-nowrap uppercase"
          :class="
            name === part ? 'border-acc text-txt-hi' : 'border-transparent text-txt-low hover:text-txt-hi'
          "
          @click="part = name"
        >
          {{ t(`storyPart.${name}`) }}
          <span v-if="name === 'tests' && !complete" class="text-orange">·</span>
        </button>
      </nav>

      <div class="mt-5 min-h-0 flex-1 overflow-auto">
        <StoryTicket :ticket="ticket.data.value" :part="part" @pick="askClaude" />

        <form
          v-if="part === 'functional' && ticket.data.value !== null"
          class="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-card p-4"
          @submit.prevent="linkBlocker"
        >
          <label
            class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase"
            for="blocker"
          >
            {{ t('story.blockerLabel') }}
          </label>
          <select
            id="blocker"
            v-model="blockingStoryId"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          >
            <option :value="null">{{ t('story.nothingBlocks') }}</option>
            <option v-for="story in others" :key="story.id" :value="story.id">
              {{ story.reference }} · {{ story.title }}
            </option>
          </select>
          <button
            type="submit"
            :disabled="busy || blockingStoryId === null"
            class="self-start rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
          >
            {{ t('common.link') }}
          </button>
        </form>

        <form
          v-if="part === 'tests' && ticket.data.value?.tests === null"
          class="mt-6 flex flex-col gap-2 rounded-2xl border border-violet bg-card p-4"
          @submit.prevent="submitTwin"
        >
          <p class="display-italic text-sm text-violet">{{ t('story.twinTitle') }}</p>
          <input
            v-model="twinTitle"
            type="text"
            :placeholder="t('story.twinTitlePlaceholder')"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <textarea
            v-model="twinBody"
            rows="3"
            :placeholder="t('story.twinBodyPlaceholder')"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          ></textarea>
          <button
            type="submit"
            :disabled="busy"
            class="rounded-lg border border-violet bg-violet-soft/20 px-3 py-2 text-xs font-bold text-violet uppercase disabled:opacity-50"
          >
            {{ t('story.writeTwin') }}
          </button>
        </form>
      </div>
    </section>
  </div>
  </div>
</template>
