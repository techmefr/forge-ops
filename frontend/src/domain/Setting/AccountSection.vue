<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EffectBadge from './EffectBadge.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import RequiredStar from '@/technical/Ui/RequiredStar.vue'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useRefusalFocus } from '@/technical/Ui/FieldState'
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

const profileForm = ref<HTMLElement | null>(null)
const passwordForm = ref<HTMLElement | null>(null)
useRefusalFocus(profileRefusal, profileForm)
useRefusalFocus(passwordRefusal, passwordForm)
onMounted(load)
</script>

<template>
  <section class="flex flex-col gap-6 border-t border-line pt-6">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('setting.account') }}</h2>
      <EffectBadge section="account" />
    </div>

    <p v-if="absent" class="text-[13px] text-txt-low">{{ t('setting.localModeNote') }}</p>

    <template v-else-if="account !== null">
      <p class="font-mono text-[11px] text-txt-low uppercase">
        {{ account.login }} · {{ t(`role.${account.role}`) }}
      </p>

      <form ref="profileForm" class="flex flex-col gap-4" @submit.prevent="saveProfile">
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.displayName')
          }} <RequiredStar /></span>
          <input
            v-model="displayName"
            v-bind="requiredField(profileRefusal, 'profile-refusal')"
            type="text"
            class="max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.emailAddress')
          }}</span>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            :placeholder="t('setting.emailPlaceholder')"
            class="max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            :disabled="busy"
            class="rounded-md border border-acc bg-acc px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
          >
            {{ t('common.save') }}
          </button>
          <span v-if="profileSaved" class="text-[13px] text-green" role="status">{{ t('setting.accountSaved') }}</span>
        </div>
        <RequiredNote />
        <p v-if="profileRefusal !== null" id="profile-refusal" class="text-[13px] text-red" role="alert">
          {{ say(profileRefusal) }}
        </p>
      </form>

      <form ref="passwordForm" class="flex flex-col gap-4 border-t border-line pt-5" @submit.prevent="savePassword">
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.currentPassword')
          }} <RequiredStar /></span>
          <input
            v-model="currentPassword"
            v-bind="requiredField(passwordRefusal, 'password-refusal')"
            type="password"
            autocomplete="current-password"
            class="max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-2">
          <span class="font-mono text-[11px] tracking-[0.18em] text-txt-low uppercase">{{
            t('setting.newPassword')
          }} <RequiredStar /></span>
          <input
            v-model="nextPassword"
            v-bind="requiredField(passwordRefusal, 'password-refusal')"
            type="password"
            autocomplete="new-password"
            class="max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
          <span class="text-[13px] text-txt-low">{{ t('setting.passwordHint') }}</span>
        </label>
        <div class="flex items-center gap-3">
          <button
            type="submit"
            :disabled="busy"
            class="rounded-md border border-acc bg-acc px-4 py-2 text-[13px] font-medium text-ink disabled:opacity-40"
          >
            {{ t('setting.changePassword') }}
          </button>
          <span v-if="passwordSaved" class="text-[13px] text-green" role="status">{{
            t('setting.passwordChanged')
          }}</span>
        </div>
        <RequiredNote />
        <p v-if="passwordRefusal !== null" id="password-refusal" class="text-[13px] text-red" role="alert">
          {{ say(passwordRefusal) }}
        </p>
      </form>
    </template>
  </section>
</template>
