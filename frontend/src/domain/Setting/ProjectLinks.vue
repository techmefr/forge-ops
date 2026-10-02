<script setup lang="ts">
import { safeHref } from '@/technical/Ui/SafeHref'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { LINK_KINDS, type LinkKind, type SubjectLink } from '@contract/EpicContract'

const props = defineProps<{ name: string; links: readonly SubjectLink[]; identifier: number }>()

const emit = defineEmits<{ update: [links: readonly SubjectLink[]] }>()

const { t } = useI18n()

const kind = ref<LinkKind>('repo')
const address = ref('')

function add(): void {
  const url = address.value.trim()
  if (url === '') {
    return
  }
  emit('update', [...props.links, { kind: kind.value, url }])
  address.value = ''
}

function drop(index: number): void {
  emit('update', props.links.filter((_, position) => position !== index))
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <ul v-if="links.length > 0" class="flex flex-wrap gap-2">
      <li
        v-for="(link, index) in links"
        :key="`${link.kind}-${link.url}-${index}`"
        class="relative flex max-w-full items-center gap-1.5 rounded-md bg-panel px-2 py-1 text-xs"
      >
        <span class="text-txt-mid">{{ t(`linkKind.${link.kind}`) }}</span>
        <a
          :href="safeHref(link.url)"
          target="_blank"
          rel="noopener noreferrer"
          class="min-w-0 max-w-[16rem] truncate text-txt-hi underline max-sm:py-3"
          >{{ link.url }}<span class="sr-only"> {{ t('team.opensNewTab') }}</span></a
        >
        <button
          type="button"
          class="rounded px-1 text-txt-mid hover:text-red max-sm:min-h-10 max-sm:min-w-10"
          :aria-label="t('team.removeLink', { kind: t(`linkKind.${link.kind}`), name })"
          @click="drop(index)"
        >
          <span aria-hidden="true">×</span>
        </button>
      </li>
    </ul>
    <p v-else class="text-xs text-txt-low">{{ t('team.noLinks') }}</p>

    <form class="flex flex-wrap items-center gap-2" @submit.prevent="add">
      <label class="sr-only" :for="`link-kind-${identifier}`">{{ t('team.linkKind') }}</label>
      <select
        :id="`link-kind-${identifier}`"
        v-model="kind"
        class="field"
      >
        <option v-for="option in LINK_KINDS" :key="option" :value="option">
          {{ t(`linkKind.${option}`) }}
        </option>
      </select>
      <label class="sr-only" :for="`link-url-${identifier}`">{{ t('team.linkUrl', { name }) }}</label>
      <input
        :id="`link-url-${identifier}`"
        v-model="address"
        type="url"
        placeholder="https://"
        class="field min-w-0 flex-1"
      />
      <button
        type="submit"
        :disabled="address.trim() === ''"
        class="btn btn-ghost btn-sm"
      >
        {{ t('team.addLink') }}
      </button>
    </form>
  </div>
</template>
