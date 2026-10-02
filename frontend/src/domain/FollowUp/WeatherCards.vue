<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Glyph from '@/technical/Ui/Glyph.vue'
import ScreenState from '@/technical/Ui/ScreenState.vue'
import { tintOf } from '@/technical/Ui/Tint'
import { dayLabel } from './DayLabel'
import FollowUpDrawer from './FollowUpDrawer.vue'
import { useFollowUps, type ProjectWeather } from './UseFollowUps'
import { WEATHER_TONES } from './WeatherTone'

const props = withDefaults(defineProps<{ projectId?: number | null }>(), { projectId: null })

const { t, locale } = useI18n()

const followUps = useFollowUps()
const opened = ref<number | null>(null)

const shown = computed(() =>
  (followUps.data.value ?? []).filter(
    (entry) => props.projectId === null || entry.project.id === props.projectId,
  ),
)

const drawerEntry = computed(() => shown.value.find((entry) => entry.project.id === opened.value) ?? null)

function weatherWord(entry: ProjectWeather): string {
  return t(`weather.${entry.followUp.weather}`)
}

function progressPercent(entry: ProjectWeather): number {
  return entry.tally.total === 0 ? 0 : Math.round((entry.tally.done / entry.tally.total) * 100)
}

function progressLine(entry: ProjectWeather): string {
  return entry.tally.total === 0
    ? t('followUp.noSubject')
    : t('followUp.progress', { done: entry.tally.done, total: entry.tally.total })
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

function openFollowUp(entry: ProjectWeather): void {
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
      class="grid flex-none grid-cols-1 gap-4 min-[640px]:grid-cols-2 min-[1024px]:grid-cols-3 min-[1440px]:grid-cols-4"
      :aria-label="t('followUp.cardsAria')"
      data-test-id="weather-cards"
    >
      <li v-for="entry in shown" :key="entry.project.id" :data-test-id="`weather-card-${entry.project.id}`">
        <button
          type="button"
          class="card card-hover flex h-full w-full flex-col gap-3 p-4 text-left"
          @click="openFollowUp(entry)"
        >
          <span class="flex items-center gap-2">
            <span
              class="size-3 flex-none rounded-full"
              :style="{ background: tintOf(entry.project.colour) }"
              aria-hidden="true"
            />
            <strong class="title-face min-w-0 flex-1 truncate text-base text-txt-hi">{{ entry.project.name }}</strong>
            <span
              class="flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="WEATHER_TONES[entry.followUp.weather].chip"
            >
              <Glyph :name="WEATHER_TONES[entry.followUp.weather].icon" :size="14" />
              <span data-test-id="weather-word">{{ weatherWord(entry) }}</span>
            </span>
          </span>
          <span v-if="entry.followUp.statusSentence !== null" class="text-sm text-txt-mid">
            {{ entry.followUp.statusSentence }}
          </span>
          <span class="grid grid-cols-3 gap-2 text-center" data-test-id="weather-counters">
            <span class="flex flex-col rounded-md bg-elev px-2 py-1.5">
              <b class="text-base font-semibold tabular-nums text-txt-hi">{{ entry.followUp.alerts.late }}</b>
              <small class="text-xs text-txt-mid">{{ t('followUp.counterLate') }}</small>
            </span>
            <span class="flex flex-col rounded-md bg-elev px-2 py-1.5">
              <b class="text-base font-semibold tabular-nums text-txt-hi">{{ entry.followUp.alerts.blocked }}</b>
              <small class="text-xs text-txt-mid">{{ t('followUp.counterBlocked') }}</small>
            </span>
            <span class="flex flex-col rounded-md bg-elev px-2 py-1.5">
              <b class="text-base font-semibold tabular-nums text-txt-hi">{{ entry.tally.open }}</b>
              <small class="text-xs text-txt-mid">{{ t('followUp.counterOpen') }}</small>
            </span>
          </span>
          <span class="flex flex-col gap-1">
            <span
              class="h-1.5 w-full overflow-hidden rounded-full bg-elev"
              role="progressbar"
              :aria-valuenow="entry.tally.done"
              aria-valuemin="0"
              :aria-valuemax="entry.tally.total"
              :aria-label="progressLine(entry)"
            >
              <span class="block h-full rounded-full bg-info" :style="{ width: `${progressPercent(entry)}%` }" />
            </span>
            <span class="text-xs text-txt-mid">{{ progressLine(entry) }}</span>
          </span>
          <span class="flex flex-col gap-0.5 text-xs text-txt-mid">
            <span v-if="entry.followUp.alerts.highRisks > 0" class="font-medium text-red">{{
              t('followUp.alertHighRisks', { count: entry.followUp.alerts.highRisks }, entry.followUp.alerts.highRisks)
            }}</span>
            <span>{{ nextEventLine(entry) }}</span>
          </span>
        </button>
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
