<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import { tintOf } from '@/technical/Ui/Tint'
import type { FollowUpAlerts } from '@contract/FollowUpContract'
import { dayLabel } from './DayLabel'
import FollowUpDrawer from './FollowUpDrawer.vue'
import { useFollowUps, type ProjectWeather } from './UseFollowUps'
import { WEATHER_TONES } from './WeatherTone'

const props = withDefaults(defineProps<{ projectId?: number | null }>(), { projectId: null })

const { t, locale } = useI18n()

const followUps = useFollowUps()
const revealed = ref<number | null>(null)
const opened = ref<number | null>(null)

const shown = computed(() =>
  (followUps.data.value ?? []).filter(
    (entry) => props.projectId === null || entry.project.id === props.projectId,
  ),
)

const drawerEntry = computed(() => shown.value.find((entry) => entry.project.id === opened.value) ?? null)

function panelId(entry: ProjectWeather): string {
  return `weather-panel-${entry.project.id}`
}

function weatherWord(entry: ProjectWeather): string {
  return t(`weather.${entry.followUp.weather}`)
}

function alertLines(alerts: FollowUpAlerts): readonly string[] {
  return [
    alerts.late > 0 ? t('followUp.alertLate', { count: alerts.late }) : '',
    alerts.blocked > 0 ? t('followUp.alertBlocked', { count: alerts.blocked }) : '',
    alerts.highRisks > 0
      ? t('followUp.alertHighRisks', { count: alerts.highRisks }, alerts.highRisks)
      : '',
    alerts.minutesToWrite > 0
      ? t('followUp.alertMinutes', { count: alerts.minutesToWrite }, alerts.minutesToWrite)
      : '',
  ].filter((line) => line !== '')
}

function nextEventLine(entry: ProjectWeather): string {
  const event = entry.followUp.nextEvent
  if (event === null) {
    return t('followUp.noEvent')
  }
  return t('followUp.nextEvent', {
    type: t(`milestone.${event.type}`).toLowerCase(),
    date: dayLabel(event.date, locale.value),
    title: event.title === '' ? t(`milestone.${event.type}`) : event.title,
  })
}

function reveal(entry: ProjectWeather): void {
  revealed.value = entry.project.id
}

function conceal(event: Event, entry: ProjectWeather): void {
  const zone = event.currentTarget
  const focusInside = zone instanceof HTMLElement && zone.contains(document.activeElement)
  if (!focusInside && revealed.value === entry.project.id) {
    revealed.value = null
  }
}

function concealOnBlur(event: FocusEvent, entry: ProjectWeather): void {
  const zone = event.currentTarget
  const next = event.relatedTarget
  if (zone instanceof HTMLElement && next instanceof Node && zone.contains(next)) {
    return
  }
  if (revealed.value === entry.project.id) {
    revealed.value = null
  }
}

function dismiss(): void {
  revealed.value = null
}

function openFollowUp(entry: ProjectWeather): void {
  revealed.value = null
  opened.value = entry.project.id
}

defineExpose({ reload: followUps.reload })

followUps.reload()
</script>

<template>
  <ScreenState
    :pending="followUps.pending.value && followUps.data.value === null"
    :failure="followUps.failure.value"
    :empty="false"
    empty-key="followUp.empty"
    @retry="followUps.reload()"
  >
    <ul
      v-if="shown.length > 0"
      class="grid flex-none grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-6 max-[760px]:grid-cols-1"
      :aria-label="t('followUp.cardsAria')"
      data-test-id="weather-cards"
    >
      <li
        v-for="entry in shown"
        :key="entry.project.id"
        class="relative"
        :data-test-id="`weather-card-${entry.project.id}`"
        @mouseenter="reveal(entry)"
        @mouseleave="conceal($event, entry)"
        @focusin="reveal(entry)"
        @focusout="concealOnBlur($event, entry)"
        @keydown.esc="dismiss"
      >
        <button
          type="button"
          class="flex min-h-10 w-full flex-col gap-1 border-b border-line px-1 py-2.5 text-left hover:bg-elev/60"
          :aria-describedby="panelId(entry)"
          @click="openFollowUp(entry)"
        >
          <span class="flex items-center gap-2">
            <span
              class="size-2.5 flex-none rounded-full"
              :style="{ background: tintOf(entry.project.colour) }"
              aria-hidden="true"
            />
            <strong class="title-face text-sm text-txt-hi uppercase">{{ entry.project.name }}</strong>
            <span class="ml-auto flex items-center gap-1.5 text-[13px] font-semibold text-txt-hi">
              <b
                class="text-xl leading-none"
                :class="WEATHER_TONES[entry.followUp.weather].text"
                aria-hidden="true"
              >
                {{ WEATHER_TONES[entry.followUp.weather].glyph }}
              </b>
              <span data-test-id="weather-word">{{ weatherWord(entry) }}</span>
            </span>
          </span>
          <span v-if="entry.followUp.statusSentence !== null" class="text-[13px] text-txt-mid">
            {{ entry.followUp.statusSentence }}
          </span>
        </button>
        <div
          v-show="revealed === entry.project.id"
          :id="panelId(entry)"
          class="absolute inset-x-0 top-full z-20 -mt-1 flex flex-col gap-1 rounded-md border border-line bg-panel px-3 py-2.5 text-xs text-txt-mid max-[760px]:hidden"
          data-test-id="weather-panel"
        >
          <span v-if="alertLines(entry.followUp.alerts).length === 0">{{ t('followUp.panelNothing') }}</span>
          <span v-else class="font-semibold text-txt-hi">{{ alertLines(entry.followUp.alerts).join(' · ') }}</span>
          <span>{{ nextEventLine(entry) }}</span>
          <span>{{ t(entry.followUp.source === 'manual' ? 'followUp.manual' : 'followUp.computed') }}</span>
          <span class="text-[11px] text-txt-low">{{ t('followUp.hint') }}</span>
        </div>
      </li>
    </ul>
  </ScreenState>

  <FollowUpDrawer
    v-if="drawerEntry !== null"
    :entry="drawerEntry"
    @close="opened = null"
    @changed="followUps.reload()"
  />
</template>
