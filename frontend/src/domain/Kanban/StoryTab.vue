<script setup lang="ts">
import { watch } from 'vue'
import { board } from '@/technical/Api/Board'
import { useResource } from '@/technical/Api/UseResource'
import type { KanbanStory, Ticket } from '@/domain/Board/BoardModel'
import { CHECKPOINT_LABELS } from '@/domain/Story/Checkpoint'

const props = defineProps<{ story: KanbanStory }>()

const ticket = useResource<Ticket>(() => board.read(`/api/stories/${props.story.id}/ticket`))

watch(() => props.story.id, () => ticket.reload(), { immediate: true })
</script>

<template>
  <div class="flex flex-col gap-4">
    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">Story</p>
      <p class="mt-2 text-sm whitespace-pre-wrap text-txt-hi">
        {{ ticket.data.value?.functional.body ?? 'Rien d ecrit pour l instant.' }}
      </p>
    </section>

    <section class="rounded-2xl border border-info bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-info uppercase">Story de test jumelle</p>
      <p class="mt-2 text-sm whitespace-pre-wrap text-txt-hi">
        {{ ticket.data.value?.tests?.body ?? 'La jumelle n est pas encore ecrite.' }}
      </p>
    </section>

    <section class="rounded-2xl border border-line bg-card p-4">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        Definition of done
      </p>
      <ul class="mt-2 flex flex-col gap-1.5">
        <li
          v-for="step in ticket.data.value?.dod ?? []"
          :key="step.name"
          class="flex items-center gap-2 text-xs"
        >
          <span
            class="h-2 w-2 flex-none rounded-full"
            :class="step.proven ? 'bg-green' : 'bg-line'"
          />
          <span class="text-txt-mid">{{ CHECKPOINT_LABELS[step.name] }}</span>
          <span v-if="step.evidencePath !== null" class="ml-auto font-mono text-[10px] text-acc">{{
            step.evidencePath
          }}</span>
        </li>
      </ul>
    </section>

    <RouterLink
      :to="`/story/${story.id}`"
      class="self-start rounded-lg border border-line bg-elev px-3 py-2 text-[10px] font-bold text-txt-mid uppercase hover:border-acc"
      >Ouvrir l ecran d ecriture</RouterLink
    >
  </div>
</template>
