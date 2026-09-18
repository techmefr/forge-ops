<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { SCREENS, screenOfPath } from '@/technical/Router/Screen'
import { ARMED, IDLE, resolveStroke, type Phase } from '@/technical/Router/Shortcut'
import { useAppearance } from '@/technical/Appearance/UseAppearance'
import { useTheme } from '@/technical/Theme/UseTheme'
import { useNavigation } from '@/technical/Shell/UseNavigation'
import { useFleet } from './UseFleet'
import { FLEET_JOB_STATE_SEQUENCE } from '@/domain/Board/BoardModel'
import MachineBadge from '@/domain/Resource/MachineBadge.vue'
import LanguageSwitch from '@/technical/Language/LanguageSwitch.vue'
import Glyph from '@/technical/Ui/Glyph.vue'
import TourGuide from '@/domain/Tour/TourGuide.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
useTheme()
useAppearance()
const { layout } = useNavigation()
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

onMounted(() => window.addEventListener('keydown', jump))
onBeforeUnmount(() => window.removeEventListener('keydown', jump))

watch(
  [current, layout],
  () => {
    const open = strip.value?.querySelector('[aria-current="page"]')
    open?.scrollIntoView?.({ inline: 'center', block: 'nearest' })
  },
  { flush: 'post' },
)

function jobState(state: string): string {
  return (FLEET_JOB_STATE_SEQUENCE as readonly string[]).includes(state)
    ? t(`fleetState.${state}`)
    : state
}

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
  <div class="flex h-dvh overflow-hidden bg-deep text-txt-hi">
    <aside
      v-if="layout === 'rail'"
      class="sticky top-0 hidden h-dvh w-[250px] flex-none flex-col border-r border-line bg-panel lg:flex"
    >
      <div class="flex h-[92px] flex-none flex-col justify-center border-b border-line px-5">
        <p class="display-italic text-2xl leading-none">Forge<span class="text-acc">.</span>ops</p>
        <p class="mt-2 font-mono text-[10px] font-semibold tracking-[0.22em] text-txt-low uppercase">
          {{ t('shell.orchestration') }}
        </p>
      </div>

      <nav class="flex flex-col gap-[3px] overflow-auto p-3" :aria-label="t('shell.pipeline')">
        <RouterLink
          v-for="screen in SCREENS"
          :key="screen.key"
          :to="screen.path"
          :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
          :title="t('shell.shortcut', { digit: screen.digit })"
          class="flex items-center gap-3 rounded-[10px] px-3 py-[11px] transition-colors"
          :class="
            current?.key === screen.key
              ? 'bg-acc-soft/15 text-txt-hi'
              : 'text-txt-mid hover:bg-elev hover:text-txt-hi'
          "
        >
          <span
            class="min-w-[12px] font-mono text-[10px] font-semibold"
            :class="current?.key === screen.key ? 'text-acc' : 'text-txt-low'"
            >{{ screen.digit }}</span
          >
          <Glyph :name="screen.key" :size="15" />
          <span class="display-italic text-[14.5px]">{{ t(`screen.${screen.key}.label`) }}</span>
        </RouterLink>

              </nav>

      <div class="mt-auto flex flex-col gap-3 border-t border-line px-4 py-4">
        <MachineBadge />
        <p class="font-mono text-[10px] font-bold tracking-[0.2em] text-txt-low uppercase">
          {{ t('shell.agents') }}
        </p>
        <p v-if="working.length === 0" class="text-xs text-txt-low">{{ t('shell.noSession') }}</p>
        <div
          v-for="job in working"
          :key="job.id"
          class="flex items-center gap-2 text-[12.5px] text-txt-mid"
        >
          <span class="h-1.5 w-1.5 flex-none rounded-full bg-green" />
          <span class="font-mono text-[11px]">{{ job.name ?? job.id }}</span>
          <span class="ml-auto truncate text-[11px] text-txt-low">{{
            job.intent ?? jobState(job.state)
          }}</span>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 min-h-0 flex-1 flex-col">
      <header
        class="flex-none items-stretch gap-6 overflow-x-auto border-b border-line bg-panel px-6"
        :class="layout === 'tabs' ? 'flex' : 'flex lg:hidden'"
      >
        <div class="flex flex-none items-center gap-3 py-4">
          <p class="display-italic text-[22px] leading-none">Forge<span class="text-acc">.</span>ops</p>
        </div>
        <nav ref="strip" class="flex items-stretch gap-0.5" :aria-label="t('shell.pipeline')">
          <RouterLink
            v-for="screen in SCREENS"
            :key="screen.key"
            :to="screen.path"
            :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
            :title="t('shell.shortcut', { digit: screen.digit })"
            class="flex flex-col justify-center gap-[3px] border-b-[3px] px-4 transition-colors"
            :class="
              current?.key === screen.key
                ? 'border-acc text-txt-hi'
                : 'border-transparent text-txt-mid hover:text-txt-hi'
            "
          >
            <span
              class="font-mono text-[9.5px]"
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
            <span class="font-mono text-[11px] font-semibold text-acc">{{ heading.digit }}</span>
            <h1 class="display-italic m-0 text-[34px] leading-none">{{ heading.label }}</h1>
          </div>
          <p class="mt-1 text-[12.5px] text-txt-low">{{ heading.sub }}</p>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-3">
          <LanguageSwitch />
          <template v-if="layout === 'tabs'">
            <MachineBadge />
            <span class="flex items-center gap-2 font-mono text-[10px] text-txt-low uppercase">
              <span
                class="h-1.5 w-1.5 flex-none rounded-full"
                :class="working.length === 0 ? 'bg-line' : 'bg-green'"
              />
              {{ t('shell.agentCount', { count: working.length }, working.length) }}
            </span>
          </template>
          <span
            v-if="phase !== IDLE"
            class="rounded-lg border border-acc px-2.5 py-1.5 font-mono text-[10px] text-acc uppercase"
            role="status"
            >{{ phase === ARMED ? t('shell.strokeArmed') : t('shell.strokeStarted') }}</span
          >
        </div>
      </header>

      <main class="min-h-0 min-w-0 flex-1 overflow-auto lg:overflow-hidden">
        <RouterView />
      </main>
    </div>

    <TourGuide />
  </div>
</template>
