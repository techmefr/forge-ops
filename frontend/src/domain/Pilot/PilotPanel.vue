<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  PILOT_PACE_SEQUENCE,
  PILOT_STEP_KIND_SEQUENCE,
  type ParcoursSuggestion,
} from '@/domain/Board/BoardModel'
import { usePhrase } from '@/technical/Language/UsePhrase'
import { describeStep, shotUrlOf } from './Walk'
import { usePilot } from './UsePilot'

const props = defineProps<{ storyId: number | null }>()

const emit = defineEmits<{ proven: [{ evidencePath: string }] }>()

const { t, locale } = useI18n()
const say = usePhrase()

const storyId = toRef(props, 'storyId')
const desk = usePilot(storyId)
const draftKind = ref<(typeof PILOT_STEP_KIND_SEQUENCE)[number]>('goto')
const draftTarget = ref('')
const draftValue = ref('')

const live = computed(() => desk.run.value !== null && ['running', 'paused'].includes(desk.run.value.state))
const needsValue = computed(() => ['fill', 'expectText'].includes(draftKind.value))
const needsTarget = computed(() => draftKind.value !== 'screenshot')

function suggestionReason(suggestion: ParcoursSuggestion): string {
  return t(`pilot.reason.${suggestion.reason}`, {
    references: new Intl.ListFormat(locale.value, { style: 'long', type: 'conjunction' }).format([
      ...suggestion.references,
    ]),
  })
}

watch(storyId, () => desk.load(), { immediate: true })

function addDraft(): void {
  desk.addStep({
    kind: draftKind.value,
    ...(needsTarget.value ? { target: draftTarget.value } : {}),
    ...(needsValue.value ? { value: draftValue.value } : {}),
  })
  draftTarget.value = ''
  draftValue.value = ''
}
</script>

<template>
  <section class="rounded-2xl border border-line bg-card p-4">
    <div class="flex flex-wrap items-baseline gap-3">
      <p class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('pilot.title') }}
      </p>
      <span v-if="desk.run.value !== null" class="font-mono text-[10px] text-acc uppercase">{{
        t(`pilotRunState.${desk.run.value.state}`)
      }}</span>
      <span v-if="desk.run.value !== null" class="font-mono text-[10px] text-txt-low">
        {{
          t('pilot.progress', {
            done: desk.progress.value.done,
            total: desk.progress.value.total,
          })
        }}
      </span>
    </div>

    <template v-if="!live">
      <div
        v-if="desk.suggestion.value !== null"
        class="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-elev p-3"
      >
        <p class="flex-1 text-xs text-txt-mid">{{ suggestionReason(desk.suggestion.value) }}</p>
        <button
          type="button"
          :disabled="desk.suggestion.value.script.length === 0"
          class="rounded-lg border border-acc px-3 py-1.5 text-[10px] font-bold text-acc uppercase disabled:opacity-40"
          @click="desk.takeSuggestion()"
        >
          {{ t('pilot.takeSuggestion') }}
        </button>
      </div>

      <div class="mt-3 flex flex-wrap gap-2">
        <input
          v-model="desk.url.value"
          type="url"
          :placeholder="t('pilot.urlPlaceholder')"
          :aria-label="t('pilot.urlPlaceholder')"
          class="min-w-[240px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
        <select
          v-model="desk.pace.value"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          :aria-label="t('pilot.paceLabel')"
        >
          <option v-for="pace in PILOT_PACE_SEQUENCE" :key="pace" :value="pace">
            {{ t(`pilotPace.${pace}`) }}
          </option>
        </select>
      </div>

      <div class="mt-2 flex flex-wrap gap-2">
        <select
          v-model="draftKind"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          :aria-label="t('pilot.stepKindLabel')"
        >
          <option v-for="kind in PILOT_STEP_KIND_SEQUENCE" :key="kind" :value="kind">
            {{ t(`pilotStepKind.${kind}`) }}
          </option>
        </select>
        <input
          v-if="needsTarget"
          v-model="draftTarget"
          type="text"
          :placeholder="t('pilot.targetPlaceholder')"
          :aria-label="t('pilot.targetPlaceholder')"
          class="min-w-[200px] flex-1 rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
        <input
          v-if="needsValue"
          v-model="draftValue"
          type="text"
          :placeholder="t('pilot.valuePlaceholder')"
          :aria-label="t('pilot.valuePlaceholder')"
          class="min-w-[160px] rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
        />
        <button
          type="button"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-[10px] font-bold text-txt-mid uppercase"
          @click="addDraft"
        >
          {{ t('pilot.addStep') }}
        </button>
      </div>

      <ol class="mt-3 flex flex-col gap-1.5">
        <li
          v-for="(step, index) in desk.script.value"
          :key="index"
          class="flex items-center gap-2 text-xs text-txt-hi"
        >
          <span class="font-mono text-[10px] text-txt-low">{{ index + 1 }}</span>
          <span>{{ say(describeStep(step)) }}</span>
          <button
            type="button"
            class="ml-auto font-mono text-[10px] text-red uppercase"
            @click="desk.dropStep(index)"
          >
            {{ t('common.remove') }}
          </button>
        </li>
      </ol>

      <button
        type="button"
        :disabled="desk.busy.value || desk.script.value.length === 0 || desk.url.value === ''"
        class="mt-3 rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        @click="desk.start()"
      >
        {{ t('pilot.startWalk') }}
      </button>
    </template>

    <template v-else>
      <p v-if="desk.nextStep.value !== null" class="mt-3 text-sm text-txt-hi">
        {{ t('pilot.nextStep', { step: say(describeStep(desk.nextStep.value)) }) }}
      </p>

      <div class="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          :disabled="desk.busy.value || desk.run.value?.state !== 'running'"
          class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
          @click="desk.advance()"
        >
          {{ t('pilot.advance') }}
        </button>
        <button
          v-if="desk.run.value?.state === 'running'"
          type="button"
          :disabled="desk.busy.value"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
          @click="desk.pause()"
        >
          {{ t('pilot.pause') }}
        </button>
        <button
          v-else
          type="button"
          :disabled="desk.busy.value"
          class="rounded-lg border border-green bg-elev px-3 py-2 text-xs font-bold text-green uppercase disabled:opacity-40"
          @click="desk.resume()"
        >
          {{ t('pilot.resume') }}
        </button>
        <button
          type="button"
          :disabled="desk.busy.value"
          class="rounded-lg border border-line bg-elev px-3 py-2 text-xs font-bold text-txt-mid uppercase disabled:opacity-40"
          @click="desk.inspect()"
        >
          {{ t('pilot.inspect') }}
        </button>
        <button
          type="button"
          :disabled="desk.busy.value"
          class="rounded-lg border border-red bg-elev px-3 py-2 text-xs font-bold text-red uppercase disabled:opacity-40"
          @click="desk.abandon()"
        >
          {{ t('pilot.abandon') }}
        </button>
      </div>
    </template>

    <pre
      v-if="desk.sight.value !== null"
      class="mt-3 max-h-48 overflow-auto rounded-xl border border-line bg-elev p-3 font-mono text-[11px] whitespace-pre-wrap text-txt-mid"
      >{{ desk.sight.value.detail }}</pre
    >

    <ul v-if="(desk.run.value?.acts ?? []).length > 0" class="mt-3 flex flex-col gap-1.5">
      <li
        v-for="act in desk.run.value?.acts ?? []"
        :key="act.id"
        class="flex items-center gap-2 text-xs"
      >
        <span
          class="h-2 w-2 flex-none rounded-full"
          :class="act.outcome === 'passed' ? 'bg-green' : 'bg-red'"
        />
        <span class="text-txt-hi">{{ act.detail }}</span>
        <a
          v-if="act.screenshotPath !== null"
          :href="shotUrlOf(act.screenshotPath)"
          target="_blank"
          rel="noreferrer"
          class="ml-auto font-mono text-[10px] text-acc uppercase"
          >{{ t('pilot.seeScreenshot') }}</a
        >
        <button
          v-if="act.screenshotPath !== null"
          type="button"
          class="font-mono text-[10px] text-green uppercase"
          @click="emit('proven', { evidencePath: act.screenshotPath })"
        >
          {{ t('pilot.makeEvidence') }}
        </button>
      </li>
    </ul>

    <p v-if="desk.history.value.length > 0" class="mt-3 font-mono text-[10px] text-txt-low uppercase">
      {{ t('pilot.historyCount', { count: desk.history.value.length }, desk.history.value.length) }}
    </p>

    <p v-if="desk.refusal.value !== null" class="mt-3 text-xs text-red" role="alert">
      {{ say(desk.refusal.value) }}
    </p>
  </section>
</template>
