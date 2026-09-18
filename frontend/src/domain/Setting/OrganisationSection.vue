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
  <section class="flex flex-col gap-6 rounded-2xl border border-line bg-card p-5">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="display-italic m-0 text-xl">{{ t('setting.organisation') }}</h2>
      <EffectBadge section="organisation" />
    </div>

    <p v-if="refusal !== null" class="text-xs text-red" role="alert">{{ say(refusal) }}</p>

    <div class="flex flex-col gap-2">
      <h3 class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('organisation.waysIn') }}
      </h3>
      <ul class="flex flex-col gap-1.5">
        <li
          v-for="provider in sheet.data.value?.providers ?? []"
          :key="provider.kind"
          class="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2"
        >
          <span class="text-[13px] text-txt-hi">{{ t(`provider.${provider.kind}`) }}</span>
          <span
            class="font-mono text-[10px] uppercase"
            :class="provider.enabled ? 'text-green' : 'text-txt-low'"
            >{{ provider.enabled ? t('organisation.on') : t('organisation.off') }}</span
          >
          <span v-if="provider.issuer !== null" class="font-mono text-[10px] text-txt-low">{{
            provider.issuer
          }}</span>
          <button
            v-if="sheet.data.value?.maySettle"
            type="button"
            class="ml-auto rounded-lg border border-line px-2.5 py-1 font-mono text-[10px] text-txt-mid uppercase hover:border-acc"
            @click="toggle(provider)"
          >
            {{ provider.enabled ? t('organisation.switchOff') : t('organisation.switchOn') }}
          </button>
        </li>
      </ul>
    </div>

    <div class="flex flex-col gap-2">
      <h3 class="font-mono text-[10px] tracking-[0.18em] text-txt-low uppercase">
        {{ t('organisation.instanceTokens') }}
      </h3>
      <p class="text-[13px] text-txt-mid">{{ t('organisation.instanceSaid') }}</p>

      <p v-if="minted !== null" class="rounded-xl border border-acc bg-acc-soft/10 p-3">
        <span class="font-mono text-[10px] text-acc uppercase">{{ t('organisation.shownOnce') }}</span>
        <code class="mt-1 block font-mono text-[11px] break-all text-txt-hi">{{ minted }}</code>
      </p>

      <ul class="flex flex-col gap-1.5">
        <li
          v-for="token in tokens.data.value ?? []"
          :key="token.id"
          class="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2"
        >
          <span class="text-[13px] text-txt-hi">{{ token.name }}</span>
          <span v-if="token.revokedAt !== null" class="font-mono text-[10px] text-txt-low uppercase">{{
            t('organisation.revoked')
          }}</span>
          <button
            v-else-if="sheet.data.value?.maySettle"
            type="button"
            class="ml-auto rounded-lg border border-line px-2.5 py-1 font-mono text-[10px] text-txt-mid uppercase hover:border-red"
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
          class="flex-1 rounded-lg border border-line bg-panel px-3 py-2 text-sm text-txt-hi"
        />
        <button
          type="submit"
          :disabled="tokenName.trim() === ''"
          class="rounded-lg border border-acc bg-acc px-4 py-2 text-xs font-bold text-ink uppercase disabled:opacity-40"
        >
          {{ t('organisation.mint') }}
        </button>
      </form>
    </div>
  </section>
</template>
