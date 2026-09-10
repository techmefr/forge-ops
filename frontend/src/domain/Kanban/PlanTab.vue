<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import type { KanbanStory, Ticket } from '@/domain/Board/BoardModel'
import { useTranscript } from '@/domain/Session/UseTranscript'
import { CHECKPOINT_LABELS } from '@/domain/Story/Checkpoint'

const props = defineProps<{ story: KanbanStory }>()
const emit = defineEmits<{ moved: [] }>()

const ticket = useResource<Ticket>(() => board.read(`/api/stories/${props.story.id}/ticket`))
const evidencePath = ref('')
const refusal = ref<string | null>(null)
const busy = ref(false)

const reference = computed(() => props.story.reference)
const transcript = useTranscript(reference)
const said = computed(() => transcript.visible())

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

function askPlan(): Promise<void> {
  return guard(() =>
    board.send(`/api/stories/${props.story.id}/dispatch`, 'POST', { phase: 'architecture' }),
  )
}

function acceptPlan(): Promise<void> {
  return guard(async () => {
    await board.send(`/api/stories/${props.story.id}/checkpoints`, 'POST', {
      name: 'arch_done',
      evidencePath: evidencePath.value,
    })
    evidencePath.value = ''
    await ticket.reload()
    emit('moved')
  })
}

function startBuilding(): Promise<void> {
  return guard(async () => {
    await board.send(`/api/stories/${props.story.id}/plan/accept`, 'POST')
    await ticket.reload()
    emit('moved')
  })
}

watch(() => props.story.id, () => ticket.reload(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <button
      type="button"
      :disabled="busy"
      class="self-start rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
      @click="askPlan()"
    >
      Demander un plan
    </button>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Ce que dit Claude</p>
      <p v-if="said.length === 0" class="mt-2 text-xs text-txt-low">
        Aucun plan encore. Lance la phase d architecture.
      </p>
      <article
        v-for="(utterance, index) in said"
        :key="index"
        class="mt-3 border-t border-line pt-3 first:border-0 first:pt-0"
      >
        <p class="font-mono text-[10px] text-txt-low uppercase">{{ utterance.name }}</p>
        <p v-if="utterance.text !== null" class="mt-1 text-sm whitespace-pre-wrap text-txt-hi">
          {{ utterance.text }}
        </p>
      </article>
    </section>

    <form class="rounded-2xl border border-acc bg-card p-4" @submit.prevent="acceptPlan">
      <p class="display-italic text-sm text-acc">Valider le plan</p>
      <p class="mt-1 text-xs text-txt-low">
        Le point de controle {{ CHECKPOINT_LABELS.arch_done }} exige une preuve deposee quelque part.
      </p>
      <input
        v-model="evidencePath"
        type="text"
        placeholder="docs/plan/FORGE-1.md"
        class="mt-3 w-full rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
      />
      <button
        type="submit"
        :disabled="busy || evidencePath === ''"
        class="mt-3 rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
      >
        Le plan tient
      </button>
    </form>

    <section
      v-if="story.state === 'plan_review'"
      class="rounded-2xl border border-green bg-card p-4"
    >
      <p class="display-italic text-sm text-green">Le plan est sur la table</p>
      <p class="mt-1 text-xs text-txt-low">
        Accepter le plan fait entrer la story dans la colonne Dev.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="mt-3 rounded-lg border border-green bg-green px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        @click="startBuilding()"
      >
        Lancer le dev
      </button>
    </section>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ refusal }}</p>
  </div>
</template>
