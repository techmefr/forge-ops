<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { board } from '@/technical/Api/Board'
import type { Account } from '@/domain/Board/BoardModel'
import AccountSection from './AccountSection.vue'
import AppearanceSection from './AppearanceSection.vue'
import BudgetSection from './BudgetSection.vue'
import OrganisationSection from './OrganisationSection.vue'
import DeliverySection from './DeliverySection.vue'
import ProjectsSection from './ProjectsSection.vue'
import TagsSection from './TagsSection.vue'
import UsersSection from './UsersSection.vue'
import TemplateSection from './TemplateSection.vue'
import { keepsTheOrganisation } from './SettingSection'
import type { TeamSelf } from './TeamRule'

const { t } = useI18n()

const role = ref<Account['role'] | null>(null)
const alone = ref(false)
const operator = ref<TeamSelf | null>(null)

const organisation = computed(() => keepsTheOrganisation(role.value, alone.value))
const manages = computed(() => role.value === 'director' || operator.value?.superAdmin === true)

async function look(): Promise<void> {
  try {
    operator.value = await board.read<TeamSelf>('/api/board/self')
  } catch {
    operator.value = null
  }
  try {
    const { mode } = await board.read<{ mode: 'local' | 'hub' }>('/api/board/mode')
    alone.value = mode === 'local'
    if (alone.value) {
      return
    }
    role.value = (await board.read<Account>('/api/auth/me')).role
  } catch {
    role.value = null
  }
}

type SettingTab = 'mine' | 'team' | 'organisation'

const selected = ref<SettingTab>('mine')
const tabs = computed<readonly { key: SettingTab; label: string }[]>(() => [
  { key: 'mine', label: t('settingHalf.mine') },
  { key: 'team', label: t('settingHalf.team') },
  { key: 'organisation', label: t('settingHalf.organisation') },
])

function moveTab(event: KeyboardEvent): void {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (step === 0) {
    return
  }
  event.preventDefault()
  const keys = tabs.value.map((tab) => tab.key)
  const next = keys[(keys.indexOf(selected.value) + step + keys.length) % keys.length]
  if (next !== undefined) {
    selected.value = next
    document.getElementById(`setting-tab-${next}`)?.focus()
  }
}

onMounted(() => void look())
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div
      class="flex flex-none flex-wrap gap-0.5 border-b border-hair bg-panel px-4 sm:px-8"
      role="tablist"
      :aria-label="t('settingHalf.aria')"
      data-tour="setting-tabs"
    >
      <button
        v-for="tab in tabs"
        :key="tab.key"
        :id="`setting-tab-${tab.key}`"
        type="button"
        role="tab"
        :aria-selected="selected === tab.key"
        :aria-controls="`setting-panel-${tab.key}`"
        :tabindex="selected === tab.key ? 0 : -1"
        class="min-h-10 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors"
        :class="selected === tab.key ? 'border-acc text-txt-hi' : 'border-transparent text-txt-mid hover:text-txt-hi'"
        :data-test-id="`setting-tab-${tab.key}`"
        @click="selected = tab.key"
        @keydown="moveTab"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-auto p-4 sm:p-8">
      <div class="mx-auto flex max-w-6xl flex-col gap-8">
        <section
          v-if="selected === 'mine'"
          id="setting-panel-mine"
          role="tabpanel"
          aria-labelledby="setting-tab-mine"
          class="card flex flex-col gap-4 p-6"
        >
          <p class="text-sm text-txt-mid">{{ t('settingHalf.mineSub') }}</p>
          <AppearanceSection />
          <AccountSection />
        </section>

        <section
          v-else-if="selected === 'team'"
          id="setting-panel-team"
          role="tabpanel"
          aria-labelledby="setting-tab-team"
          class="card flex flex-col gap-4 p-6"
          data-tour="setting-team"
        >
          <p class="text-sm text-txt-mid">{{ t('settingHalf.teamSub') }}</p>
          <ProjectsSection :self="operator" />
          <TagsSection />
          <UsersSection :self="operator" :manages="manages" />
        </section>

        <section
          v-else-if="organisation"
          id="setting-panel-organisation"
          role="tabpanel"
          aria-labelledby="setting-tab-organisation"
          class="card flex flex-col gap-4 p-6"
          data-tour="setting-organisation"
        >
          <p class="text-sm text-txt-mid">{{ t('settingHalf.organisationSub') }}</p>
          <TemplateSection />
          <BudgetSection />
          <OrganisationSection />
          <DeliverySection />
        </section>
        <p v-else class="text-sm text-txt-low">{{ t('settingHalf.organisationClosed') }}</p>
      </div>
    </div>
  </div>
</template>
