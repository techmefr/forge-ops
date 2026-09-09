<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { SCREENS, screenOfPath } from '@/technical/Router/Screen'
import { THEME_LABELS, THEME_NAMES } from '@/technical/Theme/Palette'
import { useTheme } from '@/technical/Theme/UseTheme'
import { useFleet } from './UseFleet'

const route = useRoute()
const { theme, mode, selectTheme, selectMode } = useTheme()
const { working } = useFleet()

const current = computed(() => screenOfPath(route.path))

const heading = computed(() => {
  if (current.value !== null) {
    return { n: current.value.n, label: current.value.label, sub: current.value.sub }
  }
  if (route.path === '/settings') {
    return { n: '--', label: 'Reglages', sub: 'Le plafond de cout et la conduite a tenir quand il tombe' }
  }
  if (route.path === '/incidents') {
    return { n: '--', label: 'Signalements', sub: 'Ce qui remonte du dehors, a trancher un par un' }
  }
  return { n: '--', label: 'Acces', sub: 'Ouvrir une session sur le board' }
})
</script>

<template>
  <div class="flex min-h-screen bg-deep text-txt-hi">
    <aside
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
            >{{ screen.n }}</span
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
        class="sticky top-0 z-40 flex flex-wrap items-center gap-4 border-b border-line bg-panel/80 px-8 py-4 backdrop-blur"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2.5">
            <span class="font-mono text-[11px] font-semibold text-acc">{{ heading.n }}</span>
            <h1 class="display-italic m-0 text-[34px] leading-none">{{ heading.label }}</h1>
          </div>
          <p class="mt-1 text-[12.5px] text-txt-low">{{ heading.sub }}</p>
        </div>

        <div class="ml-auto flex flex-wrap items-center gap-2">
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
