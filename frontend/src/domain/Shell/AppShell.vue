<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SCREENS, screenOfPath } from '@/technical/Router/Screen'
import { ARMED, IDLE, resolveStroke, type Phase } from '@/technical/Router/Shortcut'
import { THEME_LABELS, THEME_NAMES } from '@/technical/Theme/Palette'
import { useTheme } from '@/technical/Theme/UseTheme'
import { NAV_LAYOUTS, NAV_LAYOUT_LABELS } from '@/technical/Shell/Navigation'
import { useNavigation } from '@/technical/Shell/UseNavigation'
import { useFleet } from './UseFleet'

const route = useRoute()
const router = useRouter()
const { theme, mode, selectTheme, selectMode } = useTheme()
const { layout, selectLayout } = useNavigation()
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

const heading = computed(() => {
  if (current.value !== null) {
    return { digit: current.value.digit, label: current.value.label, sub: current.value.sub }
  }
  if (route.path === '/settings') {
    return { digit: '~', label: 'Reglages', sub: 'Le plafond de cout et la conduite a tenir quand il tombe' }
  }
  if (route.path === '/incidents') {
    return { digit: '~', label: 'Signalements', sub: 'Ce qui remonte du dehors, a trancher un par un' }
  }
  return { digit: '~', label: 'Acces', sub: 'Ouvrir une session sur le board' }
})
</script>

<template>
  <div class="flex min-h-screen bg-deep text-txt-hi">
    <aside
      v-if="layout === 'rail'"
      class="sticky top-0 flex h-screen w-[250px] flex-none flex-col border-r border-line bg-panel"
    >
      <div class="border-b border-line px-5 pt-6 pb-4">
        <p class="display-italic text-2xl leading-none">Forge<span class="text-acc">.</span>ops</p>
        <p class="mt-2 font-mono text-[10px] font-semibold tracking-[0.22em] text-txt-low uppercase">
          Agent orchestration
        </p>
      </div>

      <nav class="flex flex-col gap-[3px] overflow-auto p-3" aria-label="Etapes du pipeline">
        <RouterLink
          v-for="screen in SCREENS"
          :key="screen.key"
          :to="screen.path"
          :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
          :title="`z z puis ${screen.digit}, ou Alt+Maj+${screen.digit}`"
          class="flex items-center gap-3 rounded-[10px] px-3 py-[11px] transition-colors"
          :class="
            current?.key === screen.key
              ? 'bg-acc-soft/15 text-txt-hi'
              : 'text-txt-mid hover:bg-elev hover:text-txt-hi'
          "
        >
          <span
            class="min-w-[18px] font-mono text-[10px] font-semibold"
            :class="current?.key === screen.key ? 'text-acc' : 'text-txt-low'"
            >{{ screen.digit }}</span
          >
          <span class="display-italic text-[14.5px]">{{ screen.label }}</span>
        </RouterLink>
      </nav>

      <div class="mt-auto flex flex-col gap-3 border-t border-line px-4 py-4">
        <RouterLink
          to="/incidents"
          class="font-mono text-[10px] font-bold tracking-[0.2em] text-txt-low uppercase hover:text-acc"
          >Signalements</RouterLink
        >
        <RouterLink
          to="/settings"
          class="font-mono text-[10px] font-bold tracking-[0.2em] text-txt-low uppercase hover:text-acc"
          >Reglages</RouterLink
        >
        <p class="font-mono text-[10px] font-bold tracking-[0.2em] text-txt-low uppercase">
          Agents actifs
        </p>
        <p v-if="working.length === 0" class="text-xs text-txt-low">Aucune session en cours</p>
        <div
          v-for="job in working"
          :key="job.id"
          class="flex items-center gap-2 text-[12.5px] text-txt-mid"
        >
          <span class="h-1.5 w-1.5 flex-none rounded-full bg-green" />
          <span class="font-mono text-[11px]">{{ job.name ?? job.id }}</span>
          <span class="ml-auto truncate text-[11px] text-txt-low">{{ job.intent ?? job.state }}</span>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col">
      <header
        v-if="layout === 'tabs'"
        class="flex items-stretch gap-6 overflow-auto border-b border-line bg-panel px-6"
      >
        <div class="flex flex-none items-center gap-3 py-4">
          <p class="display-italic text-[22px] leading-none">Forge<span class="text-acc">.</span>ops</p>
        </div>
        <nav ref="strip" class="flex items-stretch gap-0.5" aria-label="Etapes du pipeline">
          <RouterLink
            v-for="screen in SCREENS"
            :key="screen.key"
            :to="screen.path"
            :aria-keyshortcuts="`Alt+Shift+${screen.digit}`"
            :title="`z z puis ${screen.digit}, ou Alt+Maj+${screen.digit}`"
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
            <span class="display-italic text-sm whitespace-nowrap uppercase">{{ screen.label }}</span>
          </RouterLink>
        </nav>
      </header>

      <header
        class="sticky top-0 z-40 flex flex-wrap items-center gap-4 border-b border-line bg-panel/80 px-8 py-4 backdrop-blur"
      >
        <div class="min-w-0 flex-[1_1_240px]">
          <div class="flex items-baseline gap-2.5">
            <span class="font-mono text-[11px] font-semibold text-acc">{{ heading.digit }}</span>
            <h1 class="display-italic m-0 text-[34px] leading-none">{{ heading.label }}</h1>
          </div>
          <p class="mt-1 text-[12.5px] text-txt-low">{{ heading.sub }}</p>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <template v-if="layout === 'tabs'">
            <RouterLink
              to="/incidents"
              class="font-mono text-[10px] font-bold tracking-[0.2em] text-txt-low uppercase hover:text-acc"
              >Signalements</RouterLink
            >
            <RouterLink
              to="/settings"
              class="font-mono text-[10px] font-bold tracking-[0.2em] text-txt-low uppercase hover:text-acc"
              >Reglages</RouterLink
            >
            <span class="flex items-center gap-2 font-mono text-[10px] text-txt-low uppercase">
              <span
                class="h-1.5 w-1.5 flex-none rounded-full"
                :class="working.length === 0 ? 'bg-line' : 'bg-green'"
              />
              {{ working.length }} agents
            </span>
            <span class="mx-1 h-5 w-px bg-line" />
          </template>
          <button
            v-for="name in NAV_LAYOUTS"
            :key="name"
            type="button"
            class="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase"
            :class="
              name === layout
                ? 'border-acc bg-acc text-ink'
                : 'border-line bg-card text-txt-mid hover:border-acc'
            "
            @click="selectLayout(name)"
          >
            {{ NAV_LAYOUT_LABELS[name] }}
          </button>
          <span
            v-if="phase !== IDLE"
            class="rounded-lg border border-acc px-2.5 py-1.5 font-mono text-[10px] text-acc uppercase"
            role="status"
            >{{ phase === ARMED ? 'z z … chiffre' : 'z …' }}</span
          >
          <span class="mx-1 h-5 w-px bg-line" />
          <button
            v-for="name in THEME_NAMES"
            :key="name"
            type="button"
            class="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold uppercase"
            :class="
              name === theme
                ? 'border-acc bg-acc text-ink'
                : 'border-line bg-card text-txt-mid hover:border-acc'
            "
            @click="selectTheme(name)"
          >
            {{ THEME_LABELS[name] }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11px] font-semibold text-txt-mid uppercase hover:border-acc"
            @click="selectMode(mode === 'dark' ? 'light' : 'dark')"
          >
            {{ mode === 'dark' ? 'Sombre' : 'Clair' }}
          </button>
        </div>
      </header>

      <main class="min-w-0 flex-1">
        <RouterView />
      </main>
    </div>
  </div>
</template>
