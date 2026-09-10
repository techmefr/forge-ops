<script setup lang="ts">
import { computed } from 'vue'
import ChoiceRow from './ChoiceRow.vue'
import {
  FONT_FACES,
  FONT_FACE_LABELS,
  FONT_SCALES,
  FONT_SCALE_LABELS,
} from '@/technical/Appearance/Appearance'
import { MODE_CHOICES, MODE_CHOICE_LABELS } from '@/technical/Appearance/ModeChoice'
import { useAppearance } from '@/technical/Appearance/UseAppearance'
import { THEME_LABELS, THEME_NAMES } from '@/technical/Theme/Palette'
import { useTheme } from '@/technical/Theme/UseTheme'
import { NAV_LAYOUTS, NAV_LAYOUT_LABELS } from '@/technical/Shell/Navigation'
import { useNavigation } from '@/technical/Shell/UseNavigation'
import { LANGUAGES, LANGUAGE_LABELS } from '@/technical/Language/Language'
import { useLanguage } from '@/technical/Language/UseLanguage'

const { theme, choice, selectTheme, selectMode } = useTheme()
const { face, scale, selectFace, selectScale } = useAppearance()
const { layout, selectLayout } = useNavigation()
const { language, selectLanguage } = useLanguage()

function listOf<T extends string>(keys: readonly T[], labels: Readonly<Record<T, string>>) {
  return keys.map((key) => ({ key, label: labels[key] }))
}

const themes = computed(() => listOf(THEME_NAMES, THEME_LABELS))
const modes = computed(() => listOf(MODE_CHOICES, MODE_CHOICE_LABELS))
const faces = computed(() => listOf(FONT_FACES, FONT_FACE_LABELS))
const scales = computed(() => listOf(FONT_SCALES, FONT_SCALE_LABELS))
const layouts = computed(() => listOf(NAV_LAYOUTS, NAV_LAYOUT_LABELS))
const languages = computed(() => listOf(LANGUAGES, LANGUAGE_LABELS))
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl border border-line bg-card p-5">
    <h2 class="display-italic m-0 text-xl">Apparence</h2>

    <ChoiceRow label="Palette" :options="themes" :current="theme" @select="selectTheme" />
    <ChoiceRow
      label="Clair ou sombre"
      hint="Comme le systeme suit le reglage de Windows en direct."
      :options="modes"
      :current="choice"
      @select="selectMode"
    />
    <ChoiceRow label="Police" :options="faces" :current="face" @select="selectFace" />
    <ChoiceRow
      label="Taille du texte"
      hint="Toute l interface suit, pas seulement ce cadre."
      :options="scales"
      :current="scale"
      @select="selectScale"
    />
    <ChoiceRow
      label="Navigation"
      hint="Les ecrans restent joignables au clavier par z z puis leur chiffre."
      :options="layouts"
      :current="layout"
      @select="selectLayout"
    />
    <ChoiceRow
      label="Langue"
      hint="Le cadre et les noms d ecrans suivent. Le contenu des ecrans reste en francais."
      :options="languages"
      :current="language"
      @select="selectLanguage"
    />
  </section>
</template>
