<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { addressProblemOf, type AddressProblem } from '@/technical/Api/Addresses'
import { addServer } from '@/technical/Api/Servers'
import { checkInstanceReachable } from '@/technical/Api/Reachable'
import { HOME_PATH } from '@/technical/Router/Screen'

const { t } = useI18n()

const REFUSALS: Record<AddressProblem, string> = {
  scheme: 'connect.badScheme',
  credentials: 'connect.hasCredentials',
  cleartext: 'connect.cleartext',
}

const name = ref('')
const instanceUrl = ref('')
const serverUrl = ref('')
const refusalKey = ref<string | null>(null)
const isBusy = ref(false)

async function connect(): Promise<void> {
  refusalKey.value = null
  const problem =
    addressProblemOf(instanceUrl.value) ?? (serverUrl.value === '' ? null : addressProblemOf(serverUrl.value))
  if (problem !== null) {
    refusalKey.value = REFUSALS[problem]
    return
  }
  isBusy.value = true
  const isReachable = await checkInstanceReachable(instanceUrl.value)
  isBusy.value = false
  if (!isReachable) {
    refusalKey.value = 'connect.unreachable'
    return
  }
  addServer({
    name: name.value,
    instanceUrl: instanceUrl.value.trim().replace(/\/+$/, ''),
    serverUrl: serverUrl.value.trim() === '' ? null : serverUrl.value.trim().replace(/\/+$/, ''),
  })
  window.location.assign(HOME_PATH)
}
</script>

<template>
  <div class="mx-auto max-w-md p-8">
    <section class="rounded-lg border border-line bg-card p-6">
      <p class="title-face text-[22px]">{{ t('connect.title') }}</p>
      <p class="mt-1 text-xs text-txt-low">{{ t('connect.hint') }}</p>

      <form class="mt-5 flex flex-col gap-3" @submit.prevent="connect()">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-low">
            {{ t('connect.name') }}
          </span>
          <input
            id="connect-name"
            v-model="name"
            type="text"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-low">
            {{ t('connect.instance') }}
          </span>
          <input
            id="connect-instance"
            v-model="instanceUrl"
            type="url"
            placeholder="http://localhost:8830"
            class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-low">
            {{ t('connect.server') }}
          </span>
          <input
            id="connect-server"
            v-model="serverUrl"
            type="url"
            placeholder="https://board.example.com"
            class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-sm text-txt-hi"
          />
        </label>
        <button
          type="submit"
          :disabled="isBusy || instanceUrl === ''"
          class="mt-2 rounded-lg border border-acc bg-acc px-4 py-2.5 text-xs font-bold text-ink disabled:opacity-40"
        >
          {{ t('connect.submit') }}
        </button>
        <p v-if="refusalKey !== null" class="text-xs text-red" role="alert">
          {{ t(refusalKey) }}
        </p>
      </form>
    </section>
  </div>
</template>
