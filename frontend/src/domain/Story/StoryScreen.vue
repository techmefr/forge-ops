<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import type { EpicOverview, Project } from '@/domain/Board/BoardModel'
import EpicBoard from './EpicBoard.vue'
import { useTranscript } from '@/domain/Session/UseTranscript'
import { useTicket } from './UseTicket'
import StoryTicket from './StoryTicket.vue'

const route = useRoute()
const router = useRouter()

const projects = useResource<readonly Project[]>(() => board.read('/api/projects'))
const queue = ref<readonly number[]>([])
const queueIndex = ref(0)
const queueEpics = ref<readonly EpicOverview[]>([])

const { ticket, open, write, writeTwin, declareCriterion, sendToBacklog, dispatch } = useTicket()

const reference = computed(() => ticket.data.value?.functional.reference ?? null)
const transcript = useTranscript(reference)
const said = computed(() => transcript.visible())

const title = ref('')
const body = ref('')
const twinTitle = ref('')
const twinBody = ref('')
const criterionReference = ref('')
const criterionStatement = ref('')
const criterionPersona = ref('')
const criterionRefusal = ref(false)
const refusal = ref<string | null>(null)
const busy = ref(false)

const chosenEpic = computed(() => queue.value[queueIndex.value] ?? null)
const chosenEpicTitle = computed(
  () => queueEpics.value.find((epic) => epic.id === chosenEpic.value)?.title ?? null,
)
const listing = computed(() => queue.value.length === 0 && ticket.data.value === null)

async function startQueue(chosen: readonly number[]): Promise<void> {
  const found = await Promise.all(
    (projects.data.value ?? []).map((project) =>
      board.read<readonly EpicOverview[]>(`/api/projects/${project.id}/epics`),
    ),
  )
  queueEpics.value = found.flat().filter((epic) => chosen.includes(epic.id))
  queueIndex.value = 0
  queue.value = chosen
}

function leaveQueue(): void {
  queue.value = []
  queueIndex.value = 0
  queueEpics.value = []
}

async function backToEpics(): Promise<void> {
  leaveQueue()
  await router.push('/story')
  ticket.data.value = null
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

async function submitStory(): Promise<void> {
  const epicId = chosenEpic.value
  if (epicId === null) {
    refusal.value = 'Choisis une epique avant d ecrire la story'
    return
  }
  await guard(async () => {
    const story = await write({ epicId, title: title.value, body: body.value })
    title.value = ''
    body.value = ''
    if (queueIndex.value + 1 < queue.value.length) {
      queueIndex.value += 1
      return
    }
    leaveQueue()
    await router.push(`/story/${story.id}`)
  })
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

async function submitCriterion(): Promise<void> {
  const storyId = ticket.data.value?.functional.id
  if (storyId === undefined) {
    return
  }
  await guard(async () => {
    await declareCriterion(storyId, {
      reference: criterionReference.value,
      statement: criterionStatement.value,
      persona: criterionPersona.value === '' ? null : criterionPersona.value,
      expectsRefusal: criterionRefusal.value,
    })
    criterionReference.value = ''
    criterionStatement.value = ''
    criterionPersona.value = ''
    criterionRefusal.value = false
  })
}

function askClaude(): Promise<void> {
  const storyId = ticket.data.value?.functional.id
  return storyId === undefined ? Promise.resolve() : guard(() => dispatch(storyId, 'spec'))
}

function toBacklog(): Promise<void> {
  const storyId = ticket.data.value?.functional.id
  return storyId === undefined
    ? Promise.resolve()
    : guard(async () => {
        await sendToBacklog(storyId)
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
  await projects.reload()

  const id = route.params.id
  if (typeof id === 'string' && id !== '') {
    await open(Number(id))
  }
})
</script>

<template>
  <EpicBoard v-if="listing" @chosen="startQueue" />

  <div v-else class="grid h-full min-h-[600px] grid-cols-[260px_minmax(0,1fr)_minmax(0,420px)]">
    <section class="border-r border-line p-5">
      <button
        type="button"
        class="rounded-lg border border-line bg-card px-3 py-2 font-mono text-[10px] font-bold text-txt-mid uppercase hover:border-acc"
        @click="backToEpics()"
      >
        Retour aux epiques
      </button>

      <template v-if="queue.length > 0">
        <h2 class="display-italic mt-6 text-sm text-txt-mid">Epique en cours</h2>
        <p class="mt-2 rounded-xl border border-acc bg-card p-3 text-sm text-txt-hi">
          {{ chosenEpicTitle ?? 'Epique inconnue' }}
        </p>
        <p class="mt-2 font-mono text-[10px] text-txt-low uppercase">
          {{ queueIndex + 1 }} sur {{ queue.length }}
        </p>

        <h2 class="display-italic mt-6 text-sm text-txt-mid">La fournee</h2>
        <ol class="mt-2 flex flex-col gap-1">
          <li
            v-for="(epic, index) in queueEpics"
            :key="epic.id"
            class="rounded-lg border px-3 py-2 text-xs"
            :class="
              index === queueIndex
                ? 'border-acc bg-card text-txt-hi'
                : 'border-line bg-card text-txt-low'
            "
          >
            {{ epic.title }}
          </li>
        </ol>
      </template>
    </section>

    <section class="flex min-w-0 flex-col border-r border-line p-6">
      <h2 class="display-italic text-lg">Ecrire avec Claude</h2>

      <form class="mt-4 flex flex-col gap-3" @submit.prevent="submitStory">
        <input
          v-model="title"
          type="text"
          placeholder="Titre de la story"
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        />
        <textarea
          v-model="body"
          rows="5"
          placeholder="En tant que... je veux... afin de..."
          class="rounded-lg border border-line bg-card px-3 py-2 text-sm text-txt-hi"
        ></textarea>
        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            :disabled="busy"
            class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-50"
          >
            Ecrire la story
          </button>
          <button
            type="button"
            :disabled="busy || ticket.data.value === null"
            class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="askClaude()"
          >
            Demander a Claude
          </button>
          <button
            type="button"
            :disabled="busy || ticket.data.value === null"
            class="rounded-lg border border-line bg-card px-4 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="toBacklog()"
          >
            Envoyer au backlog
          </button>
        </div>
      </form>

      <p v-if="refusal !== null" class="mt-3 text-xs text-red" role="alert">{{ refusal }}</p>

      <h3 class="display-italic mt-8 text-sm text-txt-mid">Ce que dit la session</h3>
      <p v-if="transcript.broken.value" class="mt-2 text-xs text-orange">
        Le flux du board est coupe, recharge la page
      </p>
      <p v-else-if="said.length === 0" class="mt-2 text-xs text-txt-low">
        Rien encore. Lance une phase de specification.
      </p>
      <div class="mt-2 flex flex-col gap-2 overflow-auto">
        <article
          v-for="(utterance, index) in said"
          :key="index"
          class="rounded-xl border border-line bg-card p-3"
        >
          <p class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">
            {{ utterance.name }}<span v-if="utterance.phase !== null"> · {{ utterance.phase }}</span>
          </p>
          <p v-if="utterance.text !== null" class="mt-1.5 text-sm whitespace-pre-wrap text-txt-hi">
            {{ utterance.text }}
          </p>
          <p v-if="utterance.costUsd !== null" class="mt-1.5 font-mono text-[11px] text-acc">
            {{ utterance.costUsd.toFixed(4) }} $
          </p>
        </article>
      </div>
    </section>

    <section class="min-w-0 overflow-auto p-6">
      <StoryTicket :ticket="ticket.data.value" />

      <template v-if="ticket.data.value !== null">
        <form
          v-if="ticket.data.value.tests === null"
          class="mt-6 flex flex-col gap-2 rounded-2xl border border-violet bg-card p-4"
          @submit.prevent="submitTwin"
        >
          <p class="display-italic text-sm text-violet">Story de test jumelle</p>
          <input
            v-model="twinTitle"
            type="text"
            placeholder="Titre de la jumelle"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <textarea
            v-model="twinBody"
            rows="3"
            placeholder="Ce que la jumelle doit prouver"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          ></textarea>
          <button
            type="submit"
            :disabled="busy"
            class="rounded-lg border border-violet bg-violet-soft/20 px-3 py-2 text-xs font-bold text-violet uppercase disabled:opacity-50"
          >
            Ecrire la jumelle
          </button>
        </form>

        <form
          class="mt-4 flex flex-col gap-2 rounded-2xl border border-line bg-card p-4"
          @submit.prevent="submitCriterion"
        >
          <p class="display-italic text-sm text-txt-mid">Critere d acceptation</p>
          <input
            v-model="criterionReference"
            type="text"
            placeholder="Reference, ex CA-1"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <input
            v-model="criterionStatement"
            type="text"
            placeholder="Ce qui doit etre vrai"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <input
            v-model="criterionPersona"
            type="text"
            placeholder="Persona, facultatif"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <label class="flex items-center gap-2 text-xs text-txt-mid">
            <input v-model="criterionRefusal" type="checkbox" />
            Ce critere attend un refus
          </label>
          <button
            type="submit"
            :disabled="busy"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-50"
          >
            Declarer le critere
          </button>
        </form>
      </template>
    </section>
  </div>
</template>
