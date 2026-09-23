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
import LanguageSwitch from '@/technical/Language/LanguageSwitch.vue'
import Glyph from '@/technical/Ui/Glyph.vue'
import TourGuide from '@/domain/Tour/TourGuide.vue'

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
  const open = strip.value?.querySelector<HTMLElement>('[aria-selected="true"]')
  open?.focus()
}

onMounted(() => window.addEventListener('keydown', jump))
onBeforeUnmount(() => window.removeEventListener('keydown', jump))

watch(
  current,
  () => {
    const open = strip.value?.querySelector('[aria-selected="true"]')
    open?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  },
  { flush: 'post' },
)

const heading = computed(() => {
  if (current.value !== null) {
    return {
      digit: current.value.digit,
      label: t(`screen.${current.value.key}.label`),
      sub: t(`screen.${current.value.key}.sub`),
    }
  }
  return { digit: '~', label: t('shell.access'), sub: t('shell.accessSub') }
})
</script>

<template>
  <div class="flex h-dvh flex-col overflow-hidden bg-deep text-txt-hi">
    <header class="flex flex-none items-stretch gap-6 overflow-x-auto border-b border-line bg-panel px-6">
      <div class="flex flex-none items-center gap-3 py-4">
        <p class="display-italic text-[22px] leading-none">Forge<span class="text-acc">.</span>ops</p>
      </div>
      <nav
        ref="strip"
        role="tablist"
        data-tour="shell-pipeline"
        class="flex items-stretch gap-0.5"
        :aria-label="t('shell.pipeline')"
        @keydown="ride"
      >
        <RouterLink
          v-for="screen in SCREENS"
          :key="screen.key"
          :to="screen.path"
          role="tab"
          :aria-selected="current?.key === screen.key"
          :tabindex="current?.key === screen.key ? 0 : -1"
          :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
          :title="t('shell.shortcut', { digit: screen.digit })"
          class="flex flex-col justify-center gap-[3px] border-b-[3px] px-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-acc"
          :class="
            current?.key === screen.key
              ? 'border-acc text-txt-hi'
              : 'border-transparent text-txt-mid hover:text-txt-hi'
          "
        >
          <span
            class="font-mono text-[11px]"
            :class="current?.key === screen.key ? 'text-acc' : 'text-txt-low'"
            >{{ screen.digit }}</span
          >
          <span class="flex items-center gap-1.5 whitespace-nowrap">
            <Glyph :name="screen.key" :size="14" />
            <span class="display-italic text-sm uppercase">{{
              t(`screen.${screen.key}.label`)
            }}</span>
          </span>
        </RouterLink>
      </nav>
    </header>

    <header
      class="sticky top-0 z-40 flex min-h-[92px] flex-wrap items-center gap-4 border-b border-line bg-panel/80 px-8 py-4 backdrop-blur"
    >
      <div class="min-w-0 flex-[1_1_240px]" data-tour="shell-heading">
        <div class="flex items-baseline gap-2.5">
          <span class="font-mono text-[11px] font-semibold text-txt-low">{{ heading.digit }}</span>
          <h1 class="display-italic m-0 text-[28px] leading-none">{{ heading.label }}</h1>
        </div>
        <p class="mt-1 text-[13px] text-txt-low">{{ heading.sub }}</p>
      </div>

      <div class="ml-auto flex flex-wrap items-center gap-3">
        <LanguageSwitch />
        <MachineBadge />
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
    </header>

    <main class="min-h-0 min-w-0 flex-1 overflow-auto lg:overflow-hidden">
      <RouterView />
    </main>

    <TourGuide />
  </div>
</template>
