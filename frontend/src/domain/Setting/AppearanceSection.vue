<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import EffectBadge from './EffectBadge.vue'
import ChoiceRow from './ChoiceRow.vue'
import { FONT_FACES, FONT_SCALES } from '@/technical/Appearance/Appearance'
import { MODE_CHOICES } from '@/technical/Appearance/ModeChoice'
import { useAppearance } from '@/technical/Appearance/UseAppearance'
import { THEME_LABELS, THEME_NAMES } from '@/technical/Theme/Palette'
import { useTheme } from '@/technical/Theme/UseTheme'
import LanguageSwitch from '@/technical/Language/LanguageSwitch.vue'

const { t } = useI18n()
const { theme, choice, selectTheme, selectMode } = useTheme()
const { face, scale, selectFace, selectScale } = useAppearance()

function listOf<T extends string>(keys: readonly T[], namespace: string) {
  return keys.map((key) => ({ key, label: t(`${namespace}.${key}`) }))
}

const themes = computed(() => THEME_NAMES.map((key) => ({ key, label: THEME_LABELS[key] })))
const modes = computed(() => listOf(MODE_CHOICES, 'modeChoice'))
const faces = computed(() => listOf(FONT_FACES, 'fontFace'))
const scales = computed(() => listOf(FONT_SCALES, 'fontScale'))
</script>

<template>
  <section class="flex flex-col gap-6 rounded-lg border border-line bg-card p-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-[22px]">{{ t('setting.appearance') }}</h2>
      <EffectBadge section="appearance" />
    </div>

    <ChoiceRow
      :label="t('setting.palette')"
      :options="themes"
      :current="theme"
      @select="selectTheme"
    />
    <ChoiceRow
      :label="t('setting.lightOrDark')"
      :hint="t('setting.lightOrDarkHint')"
      :options="modes"
      :current="choice"
      @select="selectMode"
    />
    <ChoiceRow :label="t('setting.font')" :options="faces" :current="face" @select="selectFace" />
    <ChoiceRow
      :label="t('setting.textSize')"
      :hint="t('setting.textSizeHint')"
      :options="scales"
      :current="scale"
      @select="selectScale"
    />

    <div class="flex flex-col gap-2">
      <LanguageSwitch />
      <span class="text-[13px] text-txt-low">{{ t('setting.languageHint') }}</span>
    </div>
  </section>
</template>
