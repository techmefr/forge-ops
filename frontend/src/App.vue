<script setup lang="ts">
import { computed } from 'vue'
import {
  ACCENT_KEYS,
  MINIMUM_CONTRAST_RATIO,
  SURFACE_KEYS,
  TEXT_KEYS,
  THEME_LABELS,
  THEME_NAMES,
  contrastRatio,
} from '@/technical/Theme/Palette'
import { useTheme } from '@/technical/Theme/UseTheme'

const { theme, mode, palette, selectTheme, selectMode } = useTheme()

const background = computed(() => (mode.value === 'light' ? palette.value.panel : palette.value.card))

const accents = computed(() =>
  ACCENT_KEYS.map((key) => ({
    key,
    value: palette.value[key],
    ratio: contrastRatio(palette.value[key], background.value),
  })),
)
</script>

<template>
  <main class="min-h-screen bg-deep p-8 text-txt-hi">
    <header class="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-6">
      <div>
        <p class="display-italic text-3xl leading-none">Forge<span class="text-acc">.</span>ops</p>
        <p class="mt-2 font-mono text-[11px] tracking-[0.22em] text-txt-low uppercase">
          Jetons de design
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="name in THEME_NAMES"
          :key="name"
          type="button"
          class="rounded-lg border px-3 py-2 text-xs font-semibold uppercase"
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
          class="rounded-lg border border-line bg-card px-3 py-2 text-xs font-semibold uppercase text-txt-mid hover:border-acc"
          @click="selectMode(mode === 'dark' ? 'light' : 'dark')"
        >
          {{ mode === 'dark' ? 'Sombre' : 'Clair' }}
        </button>
      </div>
    </header>

    <section class="mt-8">
      <h2 class="display-italic text-lg">Surfaces</h2>
      <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <li
          v-for="key in SURFACE_KEYS"
          :key="key"
          class="rounded-xl border border-line p-4"
          :style="{ background: palette[key] }"
        >
          <p class="font-mono text-[11px] text-txt-mid">{{ key }}</p>
          <p class="font-mono text-[11px] text-txt-low">{{ palette[key] }}</p>
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="display-italic text-lg">Texte</h2>
      <ul class="mt-3 grid gap-3 sm:grid-cols-3">
        <li
          v-for="key in TEXT_KEYS"
          :key="key"
          class="rounded-xl border border-line bg-card p-4"
        >
          <p class="text-base" :style="{ color: palette[key] }">Le total TTC est recalculé.</p>
          <p class="mt-2 font-mono text-[11px] text-txt-low">
            {{ key }} · {{ contrastRatio(palette[key], background).toFixed(2) }}:1
          </p>
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="display-italic text-lg">Accents</h2>
      <p class="mt-1 text-sm text-txt-mid">
        Chaque accent atteint {{ MINIMUM_CONTRAST_RATIO }}:1 sur la surface de carte.
      </p>
      <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <li
          v-for="accent in accents"
          :key="accent.key"
          class="rounded-xl border border-line bg-card p-4"
        >
          <span
            class="block h-8 w-full rounded-md"
            :style="{ background: accent.value }"
            aria-hidden="true"
          />
          <p class="mt-3 font-mono text-[11px]" :style="{ color: accent.value }">
            {{ accent.key }}
          </p>
          <p class="font-mono text-[11px] text-txt-low">{{ accent.ratio.toFixed(2) }}:1</p>
        </li>
      </ul>
    </section>
  </main>
</template>
