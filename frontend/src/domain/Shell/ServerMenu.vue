<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isDesktop } from '@/technical/Api/Addresses'
import { activateServer, readBook, removeServer } from '@/technical/Api/Servers'
import { CONNECT_PATH } from '@/technical/Router/ConnectGuard'

const { t } = useI18n()
const router = useRouter()

const isOpen = ref(false)
const book = ref(readBook())
const isVisible = isDesktop()
const activeName = computed(
  () => book.value.servers.find(server => server.id === book.value.activeId)?.name ?? t('servers.title'),
)

function toggle(): void {
  book.value = readBook()
  isOpen.value = !isOpen.value
}

function switchTo(id: string): void {
  activateServer(id)
  window.location.assign('/')
}

function forget(id: string): void {
  book.value = removeServer(id)
  if (book.value.activeId === null) {
    window.location.assign(CONNECT_PATH)
    return
  }
  window.location.assign('/')
}

async function add(): Promise<void> {
  isOpen.value = false
  await router.push(CONNECT_PATH)
}
</script>

<template>
  <div v-if="isVisible" class="relative">
    <button
      type="button"
      class="rounded-lg border border-line bg-elev px-3 py-1.5 font-mono text-[11px] text-txt-hi"
      :aria-label="`${activeName}, ${t('servers.title')}`"
      :aria-expanded="isOpen"
      @click="toggle()"
    >
      {{ activeName }}
    </button>
    <ul
      v-if="isOpen"
      class="absolute right-0 z-50 mt-1 flex min-w-56 flex-col gap-1 rounded-lg border border-line bg-card p-2"
    >
      <li v-for="server in book.servers" :key="server.id" class="flex items-center gap-2">
        <button
          type="button"
          class="flex-1 rounded px-2 py-1 text-left font-mono text-[11px] text-txt-hi"
          :aria-current="server.id === book.activeId ? 'true' : undefined"
          @click="switchTo(server.id)"
        >
          {{ server.name }}
        </button>
        <button
          type="button"
          class="rounded px-2 py-1 text-[11px] text-txt-low"
          :aria-label="`${t('servers.remove')} ${server.name}`"
          @click="forget(server.id)"
        >
          {{ t('servers.remove') }}
        </button>
      </li>
      <li>
        <button type="button" class="w-full rounded px-2 py-1 text-left text-[11px] text-acc" @click="add()">
          {{ t('servers.add') }}
        </button>
      </li>
    </ul>
  </div>
</template>
