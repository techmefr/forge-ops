<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { board } from '@/technical/Api/Board'
import { isDesktop, readAddresses } from '@/technical/Api/Addresses'
import { activeServer, rememberToken } from '@/technical/Api/Servers'
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
const isOidcRefused = new URLSearchParams(window.location.search).get('oidc') === 'refused'

function labelOf(provider: string): string {
  return provider === 'google' ? t('access.provider.google') : t('access.provider.microsoft')
}

function startUrlOf(provider: string): string {
  return `${readAddresses().instanceUrl}/api/auth/oidc/${provider}/start`
}

async function loadProviders(): Promise<void> {
  if (isDesktop()) {
    return
  }
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

const tokenForm = ref<HTMLElement | null>(null)
useRefusalFocus(refusal, tokenForm)

const signForm = ref<HTMLElement | null>(null)
useRefusalFocus(refusal, signForm)
</script>

<template>
  <div class="mx-auto max-w-md p-8">
    <section
      v-if="mode.data.value?.mode === 'local' && (mode.data.value?.localTrusted !== true || autologinFailed)"
      class="rounded-lg border border-line bg-card p-6"
    >
      <p class="display-italic text-[22px]">{{ t('access.enterBoard') }}</p>
      <p class="mt-1 text-[11px] text-txt-low">{{ t('access.tokenHint') }}</p>

      <form ref="tokenForm" class="mt-5 flex flex-col gap-3" @submit.prevent="openBoardSession()">
        <label class="flex flex-col gap-1">
          <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
            <span>{{ t('access.boardToken') }} <RequiredStar /></span>
          </span>
          <input
            v-model="boardToken"
            v-bind="requiredField(refusal, 'login-token-refusal')"
            type="password"
            autocomplete="off"
            class="rounded-lg border border-line bg-elev px-3 py-2 font-mono text-sm text-txt-hi"
          />
        </label>

        <button
          type="submit"
          :disabled="busy || boardToken === ''"
          class="mt-2 rounded-lg border border-acc bg-acc px-4 py-2.5 text-[11px] font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ t('access.openSession') }}
        </button>

        <RequiredNote />
        <p id="login-token-refusal" v-if="refusal !== null" class="text-[11px] text-red" role="alert">{{ say(refusal) }}</p>
      </form>
    </section>

    <section
      v-else-if="mode.data.value?.mode !== 'local'"
      class="rounded-lg border border-line bg-card p-6"
    >
      <p class="display-italic text-[22px]">
        {{
          state.data.value?.enrolmentOpen === true
            ? t('access.firstAccount')
            : t('access.openASession')
        }}
      </p>
      <p class="mt-1 text-[11px] text-txt-low">
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
          <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
            <span>{{ t('access.loginName') }} <RequiredStar /></span>
          </span>
          <input
            v-model="login"
            v-bind="requiredField(refusal, 'login-refusal')"
            type="text"
            autocomplete="username"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
        </label>

        <template v-if="state.data.value?.enrolmentOpen === true">
          <label class="flex flex-col gap-1">
            <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
              <span>{{ t('access.displayName') }} <RequiredStar /></span>
            </span>
            <input
              v-model="displayName"
              v-bind="requiredField(refusal, 'login-refusal')"
              type="text"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
              {{ t('access.role') }}
            </span>
            <select
              v-model="role"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            >
              <option v-for="name in ACCOUNT_ROLE_SEQUENCE" :key="name" :value="name">
                {{ t(`role.${name}`) }}
              </option>
            </select>
          </label>
        </template>

        <label class="flex flex-col gap-1">
          <span class="font-mono text-[11px] tracking-[0.16em] text-txt-low uppercase">
            <span>{{ t('access.password') }} <RequiredStar /></span>
          </span>
          <input
            v-model="password"
            v-bind="requiredField(refusal, 'login-refusal')"
            type="password"
            autocomplete="current-password"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <span class="text-[11px] text-txt-low">{{ t('access.passwordHint') }}</span>
        </label>

        <button
          type="submit"
          :disabled="busy || login === '' || password === ''"
          class="mt-2 rounded-lg border border-acc bg-acc px-4 py-2.5 text-[11px] font-bold text-ink uppercase disabled:opacity-40"
        >
          {{
            state.data.value?.enrolmentOpen === true ? t('access.createAccount') : t('access.enter')
          }}
        </button>

        <RequiredNote />
        <a
          v-for="provider in providers"
          :key="provider"
          :href="startUrlOf(provider)"
          class="rounded-lg border border-line bg-elev px-4 py-2.5 text-center text-[11px] font-bold text-txt-hi uppercase"
        >
          {{ t('access.continueWith', { provider: labelOf(provider) }) }}
        </a>
        <p v-if="isOidcRefused" class="text-[11px] text-red" role="alert">{{ t('access.oidcRefused') }}</p>
        <p id="login-refusal" v-if="refusal !== null" class="text-[11px] text-red" role="alert">{{ say(refusal) }}</p>
      </form>
    </section>
  </div>
</template>
