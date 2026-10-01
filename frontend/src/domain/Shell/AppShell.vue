<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { SCREENS, screenOfPath } from '@/technical/Router/Screen'
import { screenOfArrow } from '@/technical/Router/TabRing'
import { ARMED, IDLE, resolveStroke, type Phase } from '@/technical/Router/Shortcut'
import { useAppearance } from '@/technical/Appearance/UseAppearance'
import { useTheme } from '@/technical/Theme/UseTheme'
import { useFleet } from './UseFleet'
import MachineBadge from '@/domain/Resource/MachineBadge.vue'
import ServerMenu from './ServerMenu.vue'
import LanguageSwitch from '@/technical/Language/LanguageSwitch.vue'
import Glyph from '@/technical/Ui/Glyph.vue'
import TourGuide from '@/domain/Tour/TourGuide.vue'
import FrozenVisitBanner from './FrozenVisitBanner.vue'
import { FROZEN_VISIT } from '@/technical/Api/Visit'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
useTheme()
useAppearance()
const { working } = useFleet()

const current = computed(() => screenOfPath(route.path))

const strip = ref<HTMLElement | null>(null)

function editing(target: EventTarget | null): boolean {
  const node = target instanceof HTMLElement ? target : null
  if (node === null) {
    return false
  }
  return node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)
}

const phase = ref<Phase>(IDLE)

function jump(event: KeyboardEvent): void {
  if (editing(event.target)) {
    phase.value = IDLE
    return
  }
  const answer = resolveStroke(event, phase.value)
  phase.value = answer.phase
  if (answer.path === null) {
    return
  }
  event.preventDefault()
  void router.push(answer.path)
}

async function ride(event: KeyboardEvent): Promise<void> {
  const wanted = screenOfArrow(SCREENS, current.value?.key ?? '', event.key)
  if (wanted === null) {
    return
  }
  event.preventDefault()
  await router.push(wanted.path)
  strip.value?.querySelector<HTMLElement>('[aria-current="page"]')?.focus()
}

onMounted(() => window.addEventListener('keydown', jump))
onBeforeUnmount(() => window.removeEventListener('keydown', jump))

const heading = computed(() => {
  if (route.matched.length === 0) {
    return { digit: '', label: '', sub: '' }
  }
  if (current.value !== null) {
    return {
      digit: current.value.digit,
      label: t(`screen.${current.value.key}.label`),
      sub: t(`screen.${current.value.key}.sub`),
    }
  }
  return { digit: '~', label: t('shell.access'), sub: t('shell.accessSub') }
})

watch(
  () => `${heading.value.label} · Forge.ops`,
  (title) => {
    document.title = title
  },
  { immediate: true },
)

watch(
  current,
  () => {
    strip.value?.querySelector('[aria-current="page"]')?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  },
  { flush: 'post' },
)

</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-deep text-txt-hi">
    <header
      class="flex flex-none flex-wrap items-stretch gap-x-3 border-b border-line bg-panel px-4 sm:gap-x-6 sm:px-6 lg:flex-nowrap"
    >
      <div class="flex flex-none items-center gap-3 py-3 sm:py-4">
        <p class="display-italic text-[22px] leading-none">Forge<span class="text-acc">.</span>ops</p>
      </div>
      <nav
        ref="strip"
        data-tour="shell-pipeline"
        class="scrollbar-none order-last grid basis-full grid-cols-2 gap-0.5 min-[480px]:grid-cols-4 lg:order-none lg:flex lg:min-w-0 lg:basis-auto lg:items-stretch lg:overflow-x-auto"
        :aria-label="t('shell.pipeline')"
        @keydown="ride"
      >
        <RouterLink
          v-for="screen in SCREENS"
          :key="screen.key"
          :to="screen.path"
          :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
          :title="t('shell.shortcut', { digit: screen.digit })"
          class="flex min-h-11 flex-col justify-center gap-[3px] border-b-2 px-2 transition-colors lg:px-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acc"
          :class="
            current?.key === screen.key
              ? 'border-acc text-txt-hi'
              : 'border-transparent text-txt-mid hover:text-txt-hi'
          "
        >
          <span
            class="font-mono text-[11px]"
            :class="current?.key === screen.key ? 'text-acc' : 'text-txt-low'"
            aria-hidden="true"
            >{{ screen.digit }}</span
          >
          <span class="flex min-w-0 items-center gap-1.5 lg:whitespace-nowrap">
            <Glyph :name="screen.key" :size="14" class="max-[400px]:hidden" />
            <span class="display-italic min-w-0 text-xs uppercase [overflow-wrap:anywhere] sm:text-sm lg:[overflow-wrap:normal]">{{
              t(`screen.${screen.key}.label`)
            }}</span>
          </span>
        </RouterLink>
      </nav>
    </header>

    <section
      aria-labelledby="page-heading"
      class="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-line bg-panel/80 px-4 py-3 backdrop-blur sm:min-h-[92px] sm:gap-4 sm:px-8 sm:py-4"
    >
      <div class="min-w-0 flex-[1_1_240px]" data-tour="shell-heading">
        <div class="flex items-baseline gap-2.5">
          <span class="font-mono text-[11px] font-semibold text-txt-low">{{ heading.digit }}</span>
          <h1 id="page-heading" class="display-italic m-0 text-[22px] leading-none sm:text-[28px]">{{ heading.label }}</h1>
        </div>
        <p class="mt-1 text-[13px] text-txt-low">{{ heading.sub }}</p>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-3">
        <span id="tour-slot" class="contents" />
        <ServerMenu />
        <LanguageSwitch />
        <MachineBadge class="hidden sm:flex" />
        <span class="flex items-center gap-2 font-mono text-[11px] text-txt-low uppercase">
          <span
            class="h-1.5 w-1.5 flex-none rounded-full"
            :class="working.length === 0 ? 'bg-line' : 'bg-green'"
          />
          {{ t('shell.agentCount', { count: working.length }, working.length) }}
        </span>
        <span
          v-if="phase !== IDLE"
          class="rounded-lg border border-acc px-2.5 py-1.5 font-mono text-[11px] text-acc uppercase"
          role="status"
          >{{ phase === ARMED ? t('shell.strokeArmed') : t('shell.strokeStarted') }}</span
        >
      </div>
    </section>

    <main class="min-h-0 min-w-0 flex-1 overflow-auto lg:overflow-hidden">
      <RouterView />
    </main>

    <FrozenVisitBanner v-if="FROZEN_VISIT" />

    <TourGuide />
  </div>
</template>
