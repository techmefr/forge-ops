<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import type { KanbanStory, MergeCleanupReport, Worktree } from '@/domain/Board/BoardModel'
import { STATE_LABELS } from '@/domain/Story/Checkpoint'

const props = defineProps<{ story: KanbanStory }>()
const emit = defineEmits<{ moved: [] }>()

const worktrees = useResource<readonly Worktree[]>(() => board.read('/api/worktrees'))
const baseRef = ref('forge')
const percent = ref(0)
const cleanUp = ref<MergeCleanupReport | null>(null)
const refusal = ref<string | null>(null)
const busy = ref(false)

const worktree = computed(
  () => (worktrees.data.value ?? []).find((found) => found.storyId === props.story.id) ?? null,
)

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
    await worktrees.reload()
    emit('moved')
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

function openWorktree(): Promise<void> {
  return guard(() =>
    board.send(`/api/stories/${props.story.id}/worktree`, 'POST', { baseRef: baseRef.value }),
  )
}

function closeWorktree(force: boolean): Promise<void> {
  return guard(() => board.send(`/api/stories/${props.story.id}/worktree`, 'DELETE', { force }))
}

function rollOut(): Promise<void> {
  return guard(() =>
    board.send(`/api/stories/${props.story.id}/rollout`, 'POST', { percent: percent.value }),
  )
}

function markDone(): Promise<void> {
  return guard(async () => {
    const answer = await board.send<{ cleanUp: MergeCleanupReport }>(
      `/api/stories/${props.story.id}/done`,
      'POST',
    )
    cleanUp.value = answer.cleanUp
  })
}

function clearConflict(): Promise<void> {
  return guard(() => board.send(`/api/stories/${props.story.id}/merge-conflict`, 'DELETE'))
}

watch(() => props.story.id, () => worktrees.reload(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <section v-if="story.mergeConflict" class="rounded-2xl border border-red bg-red-soft/10 p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-red uppercase">Conflit de merge</p>
      <p class="mt-1 text-xs text-txt-mid">
        La branche ne rentre pas telle quelle. Resous puis dis-le au board.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="mt-3 rounded-lg border border-line bg-elev px-3 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
        @click="clearConflict()"
      >
        Conflit resolu
      </button>
    </section>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Etat</p>
      <p class="display-italic mt-1 text-lg">{{ STATE_LABELS[story.state] }}</p>
    </section>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Worktree</p>
      <template v-if="worktree === null">
        <label class="mt-3 flex flex-col gap-1">
          <span class="font-mono text-[10px] text-txt-low uppercase">Branche d integration</span>
          <input
            v-model="baseRef"
            type="text"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <button
          type="button"
          :disabled="busy"
          class="mt-3 rounded-lg border border-acc bg-acc px-3 py-2 text-[10px] font-bold text-ink uppercase disabled:opacity-40"
          @click="openWorktree()"
        >
          Ouvrir un worktree
        </button>
      </template>
      <template v-else>
        <p class="mt-2 font-mono text-[11px] text-txt-mid">{{ worktree.branch }}</p>
        <p class="font-mono text-[10px] text-txt-low">{{ worktree.path }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            :disabled="busy"
            class="rounded-lg border border-line bg-elev px-3 py-1.5 text-[10px] font-bold text-txt-mid uppercase disabled:opacity-40"
            @click="closeWorktree(false)"
          >
            Fermer
          </button>
          <button
            type="button"
            :disabled="busy"
            class="rounded-lg border border-red bg-elev px-3 py-1.5 text-[10px] font-bold text-red uppercase disabled:opacity-40"
            @click="closeWorktree(true)"
          >
            Fermer de force
          </button>
        </div>
      </template>
    </section>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Feature flag</p>
      <label class="mt-3 flex flex-col gap-1">
        <span class="font-mono text-[10px] text-txt-low uppercase">Part du trafic</span>
        <input
          v-model.number="percent"
          type="number"
          min="0"
          max="100"
          class="w-28 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
      </label>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="busy"
          class="rounded-lg border border-violet bg-elev px-3 py-1.5 text-[10px] font-bold text-violet uppercase disabled:opacity-40"
          @click="rollOut()"
        >
          Ouvrir le flag
        </button>
        <button
          type="button"
          :disabled="busy"
          class="rounded-lg border border-green bg-green px-3 py-1.5 text-[10px] font-bold text-ink uppercase disabled:opacity-40"
          @click="markDone()"
        >
          En production
        </button>
      </div>
      <p v-if="cleanUp !== null" class="mt-3 text-[11px] text-txt-low">
        Nettoyage : {{ cleanUp.scopesReleased }} reservations liberees,
        {{ cleanUp.worktreeClosed ? 'worktree ferme' : 'worktree garde' }}.
      </p>
    </section>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ refusal }}</p>
  </div>
</template>
