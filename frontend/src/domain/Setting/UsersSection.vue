<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { CAPACITY_MAX, CAPACITY_MIN, type BoardUserSheet } from '@contract/ProjectContract'
import { ACCOUNT_ROLE_SEQUENCE, type AccountRole } from '@contract/IdentityContract'
import EffectBadge from './EffectBadge.vue'
import { capacityFrom, initialsOf, type TeamSelf } from './TeamRule'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { phrase, type Phrase } from '@/technical/Language/Phrase'
import { usePhrase } from '@/technical/Language/UsePhrase'
import RequiredStar from '@/technical/Ui/RequiredStar.vue'
import RequiredNote from '@/technical/Ui/RequiredNote.vue'
import { requiredField, useRefusalFocus } from '@/technical/Ui/FieldState'

const props = defineProps<{ self: TeamSelf | null; manages: boolean }>()

const { t } = useI18n()
const say = usePhrase()

const users = useResource<readonly BoardUserSheet[]>(() => board.read('/api/board-users'))
const refusal = ref<Phrase | null>(null)
const addRefusal = ref<Phrase | null>(null)
const addForm = ref<HTMLElement | null>(null)
useRefusalFocus(addRefusal, addForm)
const login = ref('')
const displayName = ref('')
const password = ref('')
const role = ref<AccountRole>('architect')

const rows = computed(() => users.data.value ?? [])
const draftReady = computed(
  () => login.value.trim() !== '' && displayName.value.trim() !== '' && password.value !== '',
)

function mayEdit(user: BoardUserSheet): boolean {
  return props.manages || props.self?.login === user.login
}

async function guard(action: () => Promise<void>): Promise<void> {
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  }
  await users.reload()
}

function setCapacity(user: BoardUserSheet, event: Event): Promise<void> {
  const capacity = capacityFrom((event.target as HTMLInputElement).value)
  if (capacity === 'refused') {
    refusal.value = phrase('team.capacityRefused', { min: CAPACITY_MIN, max: CAPACITY_MAX })
    return users.reload()
  }
  return guard(async () => {
    await board.send(`/api/board-users/${user.login}`, 'PATCH', { capacity })
  })
}

function toggleSuperAdmin(user: BoardUserSheet): Promise<void> {
  return guard(async () => {
    await board.send(`/api/board-users/${user.login}`, 'PATCH', { superAdmin: !user.superAdmin })
  })
}

function toggle(user: BoardUserSheet): Promise<void> {
  return guard(async () => {
    await board.send(`/api/board-users/${user.login}`, 'PATCH', { active: !user.active })
  })
}

async function add(): Promise<void> {
  await guard(async () => {
    await board.send('/api/board-users', 'POST', {
      login: login.value.trim(),
      displayName: displayName.value.trim(),
      password: password.value,
      role: role.value,
    })
    login.value = ''
    displayName.value = ''
    password.value = ''
  })
  addRefusal.value = refusal.value
  refusal.value = null
}

void users.reload()
</script>

<template>
  <section class="flex flex-col gap-4 border-t border-line pt-6" data-tour="setting-users">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('team.users') }}</h2>
      <EffectBadge section="users" />
    </div>
    <p class="m-0 text-sm text-txt-mid">{{ t('team.usersSub') }}</p>

    <p v-if="refusal !== null" class="m-0 text-sm text-red" role="alert">{{ say(refusal) }}</p>
    <p v-if="users.failure.value !== null" class="m-0 text-sm text-red" role="alert">
      {{ say(users.failure.value) }}
    </p>
    <p v-if="rows.length === 0 && users.failure.value === null" class="m-0 text-sm text-txt-low">
      {{ t('team.noUsers') }}
    </p>

    <ul class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="user in rows"
        :key="user.id"
        class="flex flex-wrap items-center gap-3 rounded-md bg-panel px-3 py-2"
      >
        <span
          class="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-elev font-mono text-xs text-txt-hi"
          aria-hidden="true"
          >{{ initialsOf(user.displayName) }}</span
        >
        <div class="min-w-[9rem] flex-1">
          <strong class="text-sm text-txt-hi">{{ user.displayName }}</strong>
          <p class="m-0 font-mono text-xs text-txt-low">
            {{ user.login }} · {{ t(`role.${user.role}`)
            }}<template v-if="user.superAdmin"> · {{ t('team.superAdmin') }}</template>
          </p>
        </div>

        <label class="flex items-center gap-2 text-xs text-txt-low">
          {{ t('team.capacity') }}
          <input
            type="number"
            inputmode="numeric"
            :min="CAPACITY_MIN"
            :max="CAPACITY_MAX"
            :value="user.capacity ?? ''"
            :placeholder="t('team.noCapacity')"
            :disabled="!mayEdit(user)"
            :aria-label="t('team.capacityOf', { name: user.displayName })"
            class="w-20 rounded-md border border-line bg-card px-2 py-1.5 text-sm text-txt-hi disabled:opacity-60"
            @change="setCapacity(user, $event)"
          />
        </label>

        <span
          class="rounded-full border px-2 py-0.5 text-xs font-semibold"
          :class="user.active ? 'border-green text-green' : 'border-line text-txt-low'"
          >{{ user.active ? t('team.active') : t('team.inactive') }}</span
        >

        <button
          v-if="self?.superAdmin"
          type="button"
          :aria-label="`${t(user.superAdmin ? 'team.revokeSuperAdmin' : 'team.grantSuperAdmin')}: ${user.displayName}`"
          class="rounded-md border border-line px-2.5 py-1 text-xs text-txt-mid hover:border-acc"
          @click="toggleSuperAdmin(user)"
        >
          {{ user.superAdmin ? t('team.revokeSuperAdmin') : t('team.grantSuperAdmin') }}
        </button>

        <button
          v-if="manages"
          type="button"
          class="rounded-md border border-line px-2.5 py-1 text-xs text-txt-mid hover:border-acc"
          @click="toggle(user)"
        >
          {{ user.active ? t('team.deactivate') : t('team.reactivate')
          }}<span class="sr-only"> {{ user.displayName }}</span>
        </button>
      </li>
    </ul>

    <form v-if="manages" ref="addForm" class="flex flex-col gap-3" @submit.prevent="add">
      <h3 class="m-0 text-xs text-txt-low">
        {{ t('team.addUser') }}
      </h3>
      <div class="grid grid-cols-1 gap-3 min-[760px]:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm text-txt-mid">
          <span>{{ t('team.login') }} <RequiredStar /></span>
          <input
            v-model="login"
            v-bind="requiredField(addRefusal, 'users-add-refusal')"
            type="text"
            autocomplete="off"
            class="rounded-md border border-line bg-panel px-3 py-2 font-mono text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-txt-mid">
          <span>{{ t('team.displayName') }} <RequiredStar /></span>
          <input
            v-model="displayName"
            v-bind="requiredField(addRefusal, 'users-add-refusal')"
            type="text"
            autocomplete="off"
            class="rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-txt-mid">
          <span>{{ t('team.password') }} <RequiredStar /></span>
          <input
            v-model="password"
            v-bind="requiredField(addRefusal, 'users-add-refusal')"
            type="password"
            autocomplete="new-password"
            class="rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          />
          <span class="text-xs text-txt-low">{{ t('setting.passwordHint') }}</span>
        </label>
        <label class="flex flex-col gap-1 text-sm text-txt-mid">
          {{ t('team.role') }}
          <select
            v-model="role"
            class="rounded-md border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
          >
            <option v-for="option in ACCOUNT_ROLE_SEQUENCE" :key="option" :value="option">
              {{ t(`role.${option}`) }}
            </option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        :disabled="!draftReady"
        class="self-start rounded-md border border-acc bg-acc px-4 py-2 text-sm font-medium text-ink disabled:opacity-40"
      >
        {{ t('team.add') }}
      </button>
      <RequiredNote />
      <p v-if="addRefusal !== null" id="users-add-refusal" class="m-0 text-sm text-red" role="alert">
        {{ say(addRefusal) }}
      </p>
    </form>
    <p v-else class="m-0 text-xs text-txt-low">{{ t('team.managesOnly') }}</p>

    <p class="m-0 text-xs text-txt-low">{{ t('team.usersFoot') }}</p>
  </section>
</template>
