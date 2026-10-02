<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { SCREENS, screenOfPath } from '@/technical/Router/Screen'
import { screenOfArrow } from '@/technical/Router/TabRing'
import { ARMED, IDLE, resolveStroke, type Phase } from '@/technical/Router/Shortcut'
import { useAppearance } from '@/technical/Appearance/UseAppearance'
import { useTheme } from '@/technical/Theme/UseTheme'
import StatusPill from '@/domain/Resource/StatusPill.vue'
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

const current = computed(() => screenOfPath(route.path))

const strip = ref<HTMLElement | null>(null)
const main = ref<HTMLElement | null>(null)

function focusMain(): void {
  main.value?.focus()
  main.value?.scrollIntoView?.({ block: 'nearest' })
}

function editing(target: EventTarget | null): boolean {
  const node = target instanceof HTMLElement ? target : null
  if (node === null) {
    return false
  }
  return node.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)
}

function centreCurrent(): void {
  const bar = strip.value
  const link = bar?.querySelector('[aria-current="page"]')
  if (!bar || !link) {
    return
  }
  const barBox = bar.getBoundingClientRect()
  const linkBox = link.getBoundingClientRect()
  const left = bar.scrollLeft + linkBox.left - barBox.left - (barBox.width - linkBox.width) / 2
  bar.scrollTo?.({ left })
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
    centreCurrent()
  },
  { flush: 'post' },
)

</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-deep text-txt-hi">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-lg focus:border focus:border-acc focus:bg-panel focus:px-4 focus:py-3 focus:text-xs"
      data-test-id="skip-link"
      @click.prevent="focusMain"
    >
      {{ t('shell.skipToContent') }}
    </a>
    <header
      class="flex flex-none flex-wrap items-stretch gap-x-3 bg-panel px-4 sm:gap-x-6 sm:px-6 lg:flex-nowrap"
    >
      <div class="flex flex-none items-center gap-3 py-2 sm:py-4">
        <p class="title-face text-base leading-none">Forge<span class="text-acc">.</span>ops</p>
      </div>
      <nav
        ref="strip"
        data-tour="shell-pipeline"
        class="scrollbar-none order-last -mx-4 flex basis-full gap-0.5 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:order-none lg:min-w-0 lg:basis-auto lg:items-stretch"
        :aria-label="t('shell.pipeline')"
        @keydown="ride"
      >
        <RouterLink
          v-for="screen in SCREENS"
          :key="screen.key"
          :to="screen.path"
          :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
          :title="t('shell.shortcut', { digit: screen.digit })"
          class="flex min-h-11 flex-1 flex-none flex-col justify-center border-b-2 px-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acc lg:flex-none"
          :class="current?.key === screen.key ? 'border-acc text-txt-hi' : 'border-transparent text-txt-mid hover:text-txt-hi'"
        >
          <span class="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap lg:justify-start">
            <Glyph :name="screen.key" :size="14" class="max-[400px]:hidden" />
            <span class="min-w-0 text-sm font-medium">{{
              t(`screen.${screen.key}.label`)
            }}</span>
          </span>
        </RouterLink>
      </nav>
    </header>

    <section
      aria-labelledby="page-heading"
      class="sticky top-0 z-40 flex flex-wrap items-center gap-x-3 gap-y-1 bg-panel px-4 py-2 sm:gap-4 sm:px-8 sm:py-3"
    >
      <div class="min-w-0 flex-[1_1_auto] sm:flex-[1_1_240px]" data-tour="shell-heading">
        <div class="flex items-baseline gap-2.5">
          <h1 id="page-heading" class="title-face m-0 text-base leading-tight sm:text-xl">{{ heading.label }}</h1>
        </div>
        <p class="mt-0.5 text-sm text-txt-low max-sm:hidden">{{ heading.sub }}</p>
      </div>

      <div class="ml-auto flex items-center gap-1.5 sm:flex-wrap sm:gap-3">
        <span id="tour-slot" class="contents" />
        <ServerMenu />
        <LanguageSwitch />
        <StatusPill v-if="current !== null" />
        <span
          v-if="phase !== IDLE"
          class="rounded-md px-2.5 py-1.5 text-xs text-acc"
          role="status"
          >{{ phase === ARMED ? t('shell.strokeArmed') : t('shell.strokeStarted') }}</span
        >
      </div>
    </section>

    <main
      id="main-content"
      ref="main"
      tabindex="-1"
      class="min-h-0 min-w-0 flex-1 overflow-auto lg:overflow-hidden focus:outline-none"
    >
      <RouterView />
    </main>

    <FrozenVisitBanner v-if="FROZEN_VISIT" />

    <TourGuide />
  </div>
</template>
