<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { LINK_KINDS, type LinkKind } from '@contract/EpicContract'
import { isWebAddress, type LinkDraft } from './SubjectFormRule'

const props = defineProps<{ modelValue: readonly LinkDraft[]; describedby?: string }>()
const emit = defineEmits<{ 'update:modelValue': [links: readonly LinkDraft[]] }>()

const { t } = useI18n()

function replace(index: number, change: Partial<LinkDraft>): void {
  emit(
    'update:modelValue',
    props.modelValue.map((link, position) => (position === index ? { ...link, ...change } : link)),
  )
}

function add(): void {
  emit('update:modelValue', [...props.modelValue, { kind: 'repo', url: '' }])
}

function remove(index: number): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, position) => position !== index),
  )
}

function broken(link: LinkDraft): boolean {
  return link.url.trim() !== '' && !isWebAddress(link.url)
}
</script>

<template>
  <fieldset class="flex min-w-0 flex-col gap-2">
    <legend class="text-sm text-txt-mid">
      {{ t('subjects.form.links') }}
      <span class="text-xs text-txt-low">{{ t('subjects.form.linksHint') }}</span>
    </legend>
    <div v-for="(link, index) in modelValue" :key="index" class="flex flex-wrap items-center gap-2" data-test-id="form-link-row">
      <select
        :value="link.kind"
        class="field min-w-28 flex-1 sm:w-28 sm:flex-none"
        :aria-label="t('subjects.form.linkKind')"
        @change="replace(index, { kind: ($event.target as HTMLSelectElement).value as LinkKind })"
      >
        <option v-for="kind in LINK_KINDS" :key="kind" :value="kind">{{ t(`linkKind.${kind}`) }}</option>
      </select>
      <input
        :value="link.url"
        type="url"
        inputmode="url"
        autocomplete="off"
        spellcheck="false"
        placeholder="https://"
        class="field order-last basis-full font-mono sm:order-none sm:min-w-40 sm:flex-1 sm:basis-auto"
        :class="broken(link) ? 'border-red' : 'border-line'"
        :aria-label="t('subjects.form.linkUrl')"
        :aria-invalid="broken(link)"
        :aria-describedby="broken(link) ? describedby : undefined"
        data-test-id="form-link-url"
        @input="replace(index, { url: ($event.target as HTMLInputElement).value })"
      />
      <button
        type="button"
        class="btn btn-ghost flex-none"
        :aria-label="t('subjects.form.linkRemove', { position: index + 1 })"
        @click="remove(index)"
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <div>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        data-test-id="form-link-add"
        @click="add"
      >
        {{ t('subjects.form.linkAdd') }}
      </button>
    </div>
  </fieldset>
</template>
