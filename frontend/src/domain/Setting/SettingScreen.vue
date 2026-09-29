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
import WorkflowSection from './WorkflowSection.vue'
import { keepsTheOrganisation } from './SettingSection'
import type { TeamSelf } from './TeamRule'

const { t } = useI18n()

const role = ref<Account['role'] | null>(null)
const alone = ref(false)
const operator = ref<TeamSelf | null>(null)

const organisation = computed(() => keepsTheOrganisation(role.value, alone.value))
const manages = computed(() => role.value === 'director' || operator.value?.superAdmin === true)

function openWorkflow(): void {
  document.getElementById('setting-workflow')?.scrollIntoView({ block: 'start' })
}

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

onMounted(() => void look())
</script>

<template>
  <div class="flex h-full min-h-0 max-w-3xl flex-col gap-8 overflow-auto p-8">
    <section class="flex flex-col gap-4">
      <h2 class="display-italic m-0 text-[22px]">{{ t('settingHalf.mine') }}</h2>
      <p class="text-[13px] text-txt-low">{{ t('settingHalf.mineSub') }}</p>
      <AppearanceSection />
      <AccountSection />
    </section>

    <section class="flex flex-col gap-4" data-tour="setting-team">
      <h2 class="display-italic m-0 text-[22px]">{{ t('settingHalf.team') }}</h2>
      <p class="text-[13px] text-txt-low">{{ t('settingHalf.teamSub') }}</p>
      <ProjectsSection :self="operator" :workflow-reachable="organisation" @workflow="openWorkflow" />
      <TagsSection />
      <UsersSection :self="operator" :manages="manages" />
    </section>

    <section v-if="organisation" class="flex flex-col gap-4" data-tour="setting-organisation">
      <h2 class="display-italic m-0 text-[22px]">{{ t('settingHalf.organisation') }}</h2>
      <p class="text-[13px] text-txt-low">{{ t('settingHalf.organisationSub') }}</p>
      <TemplateSection />
      <div id="setting-workflow">
        <WorkflowSection />
      </div>
      <BudgetSection />
      <OrganisationSection />
      <DeliverySection />
    </section>
    <p v-else class="text-[13px] text-txt-low">{{ t('settingHalf.organisationClosed') }}</p>
  </div>
</template>
