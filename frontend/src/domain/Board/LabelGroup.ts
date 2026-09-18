import {
  ACCOUNT_ROLE_SEQUENCE,
  AGENT_LIFECYCLE_SEQUENCE,
  AGENT_PHASE_SEQUENCE,
  CHECKPOINT_SEQUENCE,
  COST_CAP_CONDUCT_SEQUENCE,
  FLEET_JOB_STATE_SEQUENCE,
  INCIDENT_STATE_SEQUENCE,
  JUDGEMENT_KIND_SEQUENCE,
  OUTCOME_CLASSES,
  PILOT_PACE_SEQUENCE,
  PILOT_RUN_STATE_SEQUENCE,
  PILOT_STEP_KIND_SEQUENCE,
  REMARK_VOICE_SEQUENCE,
  REVIEW_LENS_SEQUENCE,
  REVIEW_PASS_STATE_SEQUENCE,
  STORY_KIND_SEQUENCE,
  STORY_STATE_SEQUENCE,
} from './BoardModel.js'
import { PARCOURS_REASON_SEQUENCE } from '@contract/PilotContract'
import { ATTENTIONS } from '@contract/BoardContract'
import { DEGRADATIONS } from '@contract/DriverContract'
import { MILESTONE_KINDS } from '@contract/StoryContract'
import { SPOKEN_MARKS } from '@/domain/File/FileMarkTone'
import { DRAWER_TABS } from '@/domain/Kanban/DrawerTab'
import { THREAD_ENTRY_KINDS } from '@contract/ConversationContract'
import { DESKS } from '@/domain/Story/Desk'
import { OWNERSHIPS } from '@/domain/Story/EpicFilter'
import { PARTS } from '@/domain/Story/StoryPart'
import { FONT_FACES, FONT_SCALES } from '@/technical/Appearance/Appearance'
import { MODE_CHOICES } from '@/technical/Appearance/ModeChoice'
import { SETTING_EFFECTS } from '@/domain/Setting/SettingSection'
import { TALLY_FIGURES } from '@/domain/Personal/Tally'
import { SCREEN_SEQUENCE } from '@/technical/Router/Screen'
import { PERSONAL_TABS, PROJECT_TABS } from '@/technical/Router/ScreenTab'
import { LANGUAGES } from '@/technical/Language/Language'

export const LABEL_GROUPS: Readonly<Record<string, readonly string[]>> = {
  attention: ATTENTIONS,
  checkpoint: CHECKPOINT_SEQUENCE,
  conduct: COST_CAP_CONDUCT_SEQUENCE,
  degradation: DEGRADATIONS,
  desk: DESKS,
  drawerTab: DRAWER_TABS,
  fleetState: FLEET_JOB_STATE_SEQUENCE,
  fontFace: FONT_FACES,
  fontScale: FONT_SCALES,
  incidentState: INCIDENT_STATE_SEQUENCE,
  judgement: JUDGEMENT_KIND_SEQUENCE,
  language: LANGUAGES,
  lens: REVIEW_LENS_SEQUENCE,
  lifecycle: AGENT_LIFECYCLE_SEQUENCE,
  mark: SPOKEN_MARKS,
  milestone: MILESTONE_KINDS,
  modeChoice: MODE_CHOICES,
  outcome: OUTCOME_CLASSES,
  ownership: OWNERSHIPS,
  personalTab: PERSONAL_TABS,
  personal: TALLY_FIGURES,
  phase: AGENT_PHASE_SEQUENCE,
  'pilot.reason': PARCOURS_REASON_SEQUENCE,
  pilotPace: PILOT_PACE_SEQUENCE,
  pilotRunState: PILOT_RUN_STATE_SEQUENCE,
  pilotStepKind: PILOT_STEP_KIND_SEQUENCE,
  reviewPassState: REVIEW_PASS_STATE_SEQUENCE,
  projectTab: PROJECT_TABS,
  role: ACCOUNT_ROLE_SEQUENCE,
  screen: SCREEN_SEQUENCE,
  settingEffect: SETTING_EFFECTS,
  state: STORY_STATE_SEQUENCE,
  storyKind: STORY_KIND_SEQUENCE,
  storyPart: PARTS,
  threadEntry: THREAD_ENTRY_KINDS,
  voice: REMARK_VOICE_SEQUENCE,
}
