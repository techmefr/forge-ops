<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { board } from '@/technical/Api/Board'
import { isDesktop, readAddresses } from '@/technical/Api/Addresses'
import { activeServer, rememberToken } from '@/technical/Api/Servers'
import {
  createDesktopHandoff,
  listenForHandoff,
  openInSystemBrowser,
  startUrlOf,
} from '@/technical/Api/DesktopSignIn'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import { ACCOUNT_ROLE_SEQUENCE, type AccountRole } from '@/domain/Board/BoardModel'
import { resolveLandingPath } from '@/technical/Router/Landing'
import RequiredStar from '@/technical/Ui/RequiredStar.vue'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useRefusalFocus } from '@/technical/Ui/FieldState'

const { t } = useI18n()
const say = usePhrase()
const router = useRouter()

const mode = useResource<{ mode: 'local' | 'hub'; localTrusted?: boolean }>(() =>
  board.read('/api/board/mode'),
)
const state = useResource<{ users: number; enrolmentOpen: boolean }>(() => board.read('/api/auth/state'))

const providers = ref<string[]>([])
const isOidcRefused = ref(new URLSearchParams(window.location.search).get('oidc') === 'refused')

function labelOf(provider: string): string {
  return provider === 'google' ? t('access.provider.google') : t('access.provider.microsoft')
}

const desktopHandoff = createDesktopHandoff()

async function continueWith(provider: string): Promise<void> {
  if (!isDesktop()) {
    window.location.assign(startUrlOf(readAddresses().instanceUrl, provider, false))
    return
  }
  isOidcRefused.value = false
  const challenge = await desktopHandoff.begin()
  stopListening ??= await listenForHandoff(answer => {
    const accepted = desktopHandoff.accept(answer)
    if (accepted === null) {
      return
    }
    if ('code' in accepted) {
      void finishDesktopSignIn(accepted.code, accepted.verifier)
      return
    }
    isOidcRefused.value = true
  })
  await openInSystemBrowser(startUrlOf(readAddresses().instanceUrl, provider, true, challenge))
}

async function finishDesktopSignIn(code: string, verifier: string): Promise<void> {
  await guard(async () => {
    const opened = await board.send<{ token: string }>('/api/auth/oidc/exchange', 'POST', { code, verifier })
    const server = activeServer()
    if (server !== null) {
      rememberToken(server.id, opened.token)
    }
    await pushToLanding()
  })
}

let stopListening: (() => void) | null = null

async function loadProviders(): Promise<void> {
  try {
    providers.value = await board.read<string[]>('/api/auth/oidc/providers')
  } catch {
    providers.value = []
  }
}

const boardToken = ref('')
const login = ref('')
const password = ref('')
const displayName = ref('')
const role = ref<AccountRole>('architect')
const refusal = ref<Phrase | null>(null)
const busy = ref(false)
const autologinFailed = ref(false)

async function guard(action: () => Promise<void>): Promise<void> {
  busy.value = true
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  } finally {
    busy.value = false
  }
}

async function pushToLanding(): Promise<void> {
  await router.push(await resolveLandingPath(() => board.read('/api/projects')))
}

function signIn(): Promise<void> {
  return guard(async () => {
    const opened = await board.send<{ token?: string }>('/api/auth/login', 'POST', {
      login: login.value,
      password: password.value,
    })
    const server = activeServer()
    if (isDesktop() && server !== null && typeof opened.token === 'string') {
      rememberToken(server.id, opened.token)
    }
    password.value = ''
    await pushToLanding()
  })
}

function openBoardSession(): Promise<void> {
  return guard(async () => {
    await board.send('/api/auth/session', 'POST', { token: boardToken.value })
    boardToken.value = ''
    await pushToLanding()
  })
}

function enrol(): Promise<void> {
  return guard(async () => {
    await board.send('/api/auth/enrol', 'POST', {
      login: login.value,
      displayName: displayName.value,
      password: password.value,
      role: role.value,
    })
    await state.reload()
  })
}

async function attemptLocalAutologin(): Promise<void> {
  try {
    await board.send('/api/auth/session/local', 'POST')
    await pushToLanding()
  } catch {
    autologinFailed.value = true
  }
}

onMounted(async () => {
  await mode.reload()
  await loadProviders()
  if (mode.data.value?.mode !== 'local') {
    await state.reload()
    return
  }
  if (mode.data.value?.localTrusted === true) {
    await attemptLocalAutologin()
  }
})

onBeforeUnmount(() => stopListening?.())

const tokenForm = ref<HTMLElement | null>(null)
useRefusalFocus(refusal, tokenForm)

const signForm = ref<HTMLElement | null>(null)
useRefusalFocus(refusal, signForm)
</script>

<template>
  <div class="mx-auto max-w-md p-8">
    <section
      v-if="mode.data.value?.mode === 'local' && (mode.data.value?.localTrusted !== true || autologinFailed)"
      class="card p-6"
    >
      <p class="title-face text-lg">{{ t('access.enterBoard') }}</p>
      <p class="mt-1 text-xs text-txt-low">{{ t('access.tokenHint') }}</p>

      <form ref="tokenForm" class="mt-5 flex flex-col gap-3" @submit.prevent="openBoardSession()">
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-low">
            <span>{{ t('access.boardToken') }} <RequiredStar /></span>
          </span>
          <input
            v-model="boardToken"
            v-bind="requiredField(refusal, 'login-token-refusal')"
            type="password"
            autocomplete="off"
            class="field font-mono"
          />
        </label>

        <button
          type="submit"
          :disabled="busy || boardToken === ''"
          class="btn btn-primary btn-sm mt-2"
        >
          {{ t('access.openSession') }}
        </button>

        <RequiredNote />
        <p id="login-token-refusal" v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>
      </form>
    </section>

    <section
      v-else-if="mode.data.value?.mode !== 'local'"
      class="card p-6"
    >
      <p class="title-face text-lg">
        {{
          state.data.value?.enrolmentOpen === true
            ? t('access.firstAccount')
            : t('access.openASession')
        }}
      </p>
      <p class="mt-1 text-xs text-txt-low">
        {{
          state.data.value?.enrolmentOpen === true
            ? t('access.firstAccountHint')
            : t('access.signInHint')
        }}
      </p>

      <form ref="signForm"
        class="mt-5 flex flex-col gap-3"
        @submit.prevent="state.data.value?.enrolmentOpen === true ? enrol() : signIn()"
      >
        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-low">
            <span>{{ t('access.loginName') }} <RequiredStar /></span>
          </span>
          <input
            v-model="login"
            v-bind="requiredField(refusal, 'login-refusal')"
            type="text"
            autocomplete="username"
            class="field"
          />
        </label>

        <template v-if="state.data.value?.enrolmentOpen === true">
          <label class="flex flex-col gap-1">
            <span class="text-xs text-txt-low">
              <span>{{ t('access.displayName') }} <RequiredStar /></span>
            </span>
            <input
              v-model="displayName"
              v-bind="requiredField(refusal, 'login-refusal')"
              type="text"
              class="field"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="text-xs text-txt-low">
              {{ t('access.role') }}
            </span>
            <select
              v-model="role"
              class="field"
            >
              <option v-for="name in ACCOUNT_ROLE_SEQUENCE" :key="name" :value="name">
                {{ t(`role.${name}`) }}
              </option>
            </select>
          </label>
        </template>

        <label class="flex flex-col gap-1">
          <span class="text-xs text-txt-low">
            <span>{{ t('access.password') }} <RequiredStar /></span>
          </span>
          <input
            v-model="password"
            v-bind="requiredField(refusal, 'login-refusal')"
            type="password"
            autocomplete="current-password"
            class="field"
          />
          <span class="text-xs text-txt-low">{{ t('access.passwordHint') }}</span>
        </label>

        <button
          type="submit"
          :disabled="busy || login === '' || password === ''"
          class="btn btn-primary btn-sm mt-2"
        >
          {{
            state.data.value?.enrolmentOpen === true ? t('access.createAccount') : t('access.enter')
          }}
        </button>

        <RequiredNote />
        <button
          v-for="provider in providers"
          :key="provider"
          type="button"
          class="rounded-lg bg-elev px-4 py-2.5 text-center text-xs font-bold text-txt-hi"
          @click="continueWith(provider)"
        >
          {{ t('access.continueWith', { provider: labelOf(provider) }) }}
        </button>
        <p v-if="isOidcRefused" class="text-xs text-red" role="alert">{{ t('access.oidcRefused') }}</p>
        <p id="login-refusal" v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>
      </form>
    </section>
  </div>
</template>
