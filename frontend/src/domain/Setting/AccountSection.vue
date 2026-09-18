<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EffectBadge from './EffectBadge.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type { Account } from '@/domain/Board/BoardModel'

const { t } = useI18n()
const say = usePhrase()

const account = ref<Account | null>(null)
const absent = ref(false)
const displayName = ref('')
const email = ref('')
const currentPassword = ref('')
const nextPassword = ref('')
const profileSaved = ref(false)
const passwordSaved = ref(false)
const profileRefusal = ref<Phrase | null>(null)
const passwordRefusal = ref<Phrase | null>(null)
const busy = ref(false)

async function load(): Promise<void> {
  try {
    const { mode } = await board.read<{ mode: 'local' | 'hub' }>('/api/board/mode')
    if (mode === 'local') {
      absent.value = true
      return
    }
    const found = await board.read<Account>('/api/auth/me')
    account.value = found
    displayName.value = found.displayName
    email.value = found.email ?? ''
    absent.value = false
  } catch {
    absent.value = true
  }
}

async function saveProfile(): Promise<void> {
  busy.value = true
  profileRefusal.value = null
  profileSaved.value = false
  try {
    await board.send('/api/auth/profile', 'PUT', {
      displayName: displayName.value,
      ...(email.value === '' ? {} : { email: email.value }),
    })
    profileSaved.value = true
    await load()
  } catch (error) {
    profileRefusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

async function savePassword(): Promise<void> {
  busy.value = true
  passwordRefusal.value = null
  passwordSaved.value = false
  try {
    await board.send('/api/auth/password', 'PUT', {
      current: currentPassword.value,
      next: nextPassword.value,
    })
    passwordSaved.value = true
    currentPassword.value = ''
    nextPassword.value = ''
  } catch (error) {
    passwordRefusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="flex flex-col gap-6 rounded-2xl border border-line bg-card p-5">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-xl">{{ t('setting.account') }}</h2>
      <EffectBadge section="account" />
    </div>

    <p v-if="absent" class="text-xs text-txt-low">{{ t('setting.localModeNote') }}</p>

    <template v-else-if="account !== null">
      <p class="font-mono text-[11px] text-txt-low uppercase">
        {{ account.login }} · {{ t(`role.${account.role}`) }}
      </p>

      <form class="flex flex-col gap-4" @submit.prevent="saveProfile">
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.displayName')
          }}</span>
          <input
            v-model="displayName"
            type="text"
            class="max-w-sm rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.emailAddress')
          }}</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            :placeholder="t('setting.emailPlaceholder')"
            class="max-w-sm rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            :disabled="busy"
            class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
          >
            {{ t('common.save') }}
          </button>
          <span v-if="profileSaved" class="text-xs text-green">{{ t('setting.accountSaved') }}</span>
        </div>
        <p v-if="profileRefusal !== null" class="text-xs text-red" role="alert">
          {{ say(profileRefusal) }}
        </p>
      </form>

      <form class="flex flex-col gap-4 border-t border-line pt-5" @submit.prevent="savePassword">
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.currentPassword')
          }}</span>
          <input
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            class="max-w-sm rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.newPassword')
          }}</span>
          <input
            v-model="nextPassword"
            type="password"
            autocomplete="new-password"
            class="max-w-sm rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
          <span class="text-xs text-txt-low">{{ t('setting.passwordHint') }}</span>
        </label>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            :disabled="busy"
            class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
          >
            {{ t('setting.changePassword') }}
          </button>
          <span v-if="passwordSaved" class="text-xs text-green">{{
            t('setting.passwordChanged')
          }}</span>
        </div>
        <p v-if="passwordRefusal !== null" class="text-xs text-red" role="alert">
          {{ say(passwordRefusal) }}
        </p>
      </form>
    </template>
  </section>
</template>
