<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { HOME_PATH } from '@/technical/Router/Screen'

const router = useRouter()

const state = useResource<{ users: number; enrolmentOpen: boolean }>(() => board.read('/api/auth/state'))

const login = ref('')
const password = ref('')
const displayName = ref('')
const role = ref<'director' | 'architect'>('architect')
const refusal = ref<string | null>(null)
const busy = ref(false)

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

function signIn(): Promise<void> {
  return guard(async () => {
    await board.send('/api/auth/login', 'POST', { login: login.value, password: password.value })
    password.value = ''
    await router.push(HOME_PATH)
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

onMounted(() => state.reload())
</script>

<template>
  <div class="mx-auto max-w-md p-8">
    <section class="rounded-2xl border border-line bg-card p-6">
      <p class="display-italic text-lg">
        {{ state.data.value?.enrolmentOpen === true ? 'Premier compte' : 'Ouvrir une session' }}
      </p>
      <p class="mt-1 text-xs text-txt-low">
        {{
          state.data.value?.enrolmentOpen === true
            ? 'Le board n a encore aucun compte. Cree le tien, l inscription se fermera ensuite.'
            : 'Le mot de passe part en https vers le board, il n est jamais stocke en clair.'
        }}
      </p>

      <form
        class="mt-5 flex flex-col gap-3"
        @submit.prevent="state.data.value?.enrolmentOpen === true ? enrol() : signIn()"
      >
        <label class="flex flex-col gap-1">
          <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Identifiant</span>
          <input
            v-model="login"
            type="text"
            autocomplete="username"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
        </label>

        <template v-if="state.data.value?.enrolmentOpen === true">
          <label class="flex flex-col gap-1">
            <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Nom affiche</span>
            <input
              v-model="displayName"
              type="text"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            />
          </label>
          <label class="flex flex-col gap-1">
            <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Role</span>
            <select
              v-model="role"
              class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
            >
              <option value="architect">Architecte IA</option>
              <option value="director">Directeur</option>
            </select>
          </label>
        </template>

        <label class="flex flex-col gap-1">
          <span class="font-mono text-[10px] tracking-[0.16em] text-txt-low uppercase">Mot de passe</span>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="rounded-lg border border-line bg-elev px-3 py-2 text-sm text-txt-hi"
          />
          <span class="text-[11px] text-txt-low">Douze caracteres au minimum.</span>
        </label>

        <button
          type="submit"
          :disabled="busy || login === '' || password === ''"
          class="mt-2 rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ state.data.value?.enrolmentOpen === true ? 'Creer le compte' : 'Entrer' }}
        </button>

        <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ refusal }}</p>
      </form>
    </section>
  </div>
</template>
