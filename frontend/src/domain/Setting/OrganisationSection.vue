<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import EffectBadge from './EffectBadge.vue'
import { board } from '@/technical/Api/Board'
import { reasonOf, useResource } from '@/technical/Api/UseResource'
import { usePhrase } from '@/technical/Language/UsePhrase'
import type { Phrase } from '@/technical/Language/Phrase'
import type {
  AuthProvider,
  InstanceToken,
  MintedToken,
  Organisation,
  ProviderKind,
} from '@contract/OrganisationContract'

const { t } = useI18n()
const say = usePhrase()

type OrganisationSheet = {
  organisation: Organisation
  providers: readonly AuthProvider[]
  waysIn: readonly ProviderKind[]
  maySettle: boolean
}

const sheet = useResource<OrganisationSheet>(() => board.read('/api/organisation'))
const tokens = useResource<readonly InstanceToken[]>(() => board.read('/api/instance/tokens'))
const tokenName = ref('')
const minted = ref<string | null>(null)
const refusal = ref<Phrase | null>(null)

async function guard(action: () => Promise<void>): Promise<void> {
  refusal.value = null
  try {
    await action()
  } catch (error) {
    refusal.value = reasonOf(error)
  }
}

function toggle(provider: AuthProvider): Promise<void> {
  return guard(async () => {
    await board.send('/api/organisation/providers', 'POST', {
      kind: provider.kind,
      enabled: !provider.enabled,
      issuer: provider.issuer,
      clientId: provider.clientId,
    })
    await sheet.reload()
  })
}

function mint(): Promise<void> {
  return guard(async () => {
    const written = await board.send<MintedToken>('/api/instance/tokens', 'POST', {
      name: tokenName.value,
    })
    minted.value = written.secret
    tokenName.value = ''
    await tokens.reload()
  })
}

function revoke(token: InstanceToken): Promise<void> {
  return guard(async () => {
    await board.send(`/api/instance/tokens/${token.id}`, 'DELETE', undefined)
    await tokens.reload()
  })
}

void sheet.reload()
void tokens.reload()
</script>

<template>
  <section class="flex flex-col gap-6 border-t border-hair pt-6">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="m-0 text-sm font-medium text-txt-hi">{{ t('setting.organisation') }}</h2>
      <EffectBadge section="organisation" />
    </div>

    <p v-if="refusal !== null" class="text-sm text-red" role="alert">{{ say(refusal) }}</p>

    <div class="flex flex-col gap-2">
      <h3 class="text-xs text-txt-low">
        {{ t('organisation.waysIn') }}
      </h3>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="provider in sheet.data.value?.providers ?? []"
          :key="provider.kind"
          class="flex items-center gap-3 rounded-md border border-line bg-panel px-3 py-2"
        >
          <span class="text-sm text-txt-hi">{{ t(`provider.${provider.kind}`) }}</span>
          <span
            class="text-xs"
            :class="provider.enabled ? 'text-green' : 'text-txt-low'"
            >{{ provider.enabled ? t('organisation.on') : t('organisation.off') }}</span
          >
          <span v-if="provider.issuer !== null" class="font-mono text-xs text-txt-low">{{
            provider.issuer
          }}</span>
          <button
            v-if="sheet.data.value?.maySettle"
            type="button"
            class="btn btn-ghost btn-sm ml-auto"
            @click="toggle(provider)"
          >
            {{ provider.enabled ? t('organisation.switchOff') : t('organisation.switchOn') }}
          </button>
        </li>
      </ul>
    </div>

    <div class="flex flex-col gap-2">
      <h3 class="text-xs text-txt-low">
        {{ t('organisation.instanceTokens') }}
      </h3>
      <p class="text-sm text-txt-mid">{{ t('organisation.instanceSaid') }}</p>

      <p v-if="minted !== null" class="rounded-md bg-elev p-3">
        <span class="text-xs text-txt-hi">{{ t('organisation.shownOnce') }}</span>
        <code class="mt-1 block font-mono text-xs break-all text-txt-hi">{{ minted }}</code>
      </p>

      <ul class="flex flex-col gap-1.5">
        <li
          v-for="token in tokens.data.value ?? []"
          :key="token.id"
          class="flex items-center gap-3 rounded-md border border-line bg-panel px-3 py-2"
        >
          <span class="text-sm text-txt-hi">{{ token.name }}</span>
          <span v-if="token.revokedAt !== null" class="text-xs text-txt-low">{{
            t('organisation.revoked')
          }}</span>
          <button
            v-else-if="sheet.data.value?.maySettle"
            type="button"
            class="btn btn-ghost btn-sm ml-auto"
            @click="revoke(token)"
          >
            {{ t('organisation.revoke') }}
          </button>
        </li>
      </ul>

      <form v-if="sheet.data.value?.maySettle" class="flex gap-2" @submit.prevent="mint">
        <label class="sr-only" for="tokenName">{{ t('organisation.tokenName') }}</label>
        <input
          id="tokenName"
          v-model="tokenName"
          type="text"
          :placeholder="t('organisation.tokenName')"
          class="field flex-1"
        />
        <button
          type="submit"
          :disabled="tokenName.trim() === ''"
          class="btn btn-primary"
        >
          {{ t('organisation.mint') }}
        </button>
      </form>
    </div>
  </section>
</template>
