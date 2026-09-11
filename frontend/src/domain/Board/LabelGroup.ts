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
import { SPOKEN_MARKS } from '@/domain/File/FileMarkTone'
import { DRAWER_TABS } from '@/domain/Kanban/DrawerTab'
import { DESKS } from '@/domain/Story/Desk'
import { OWNERSHIPS } from '@/domain/Story/EpicFilter'
import { PARTS } from '@/domain/Story/StoryPart'
import { FONT_FACES, FONT_SCALES } from '@/technical/Appearance/Appearance'
import { MODE_CHOICES } from '@/technical/Appearance/ModeChoice'
import { SCREEN_SEQUENCE } from '@/technical/Router/Screen'
import { NAV_LAYOUTS } from '@/technical/Shell/Navigation'
import { LANGUAGES } from '@/technical/Language/Language'

export const LABEL_GROUPS: Readonly<Record<string, readonly string[]>> = {
  checkpoint: CHECKPOINT_SEQUENCE,
  conduct: COST_CAP_CONDUCT_SEQUENCE,
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
  modeChoice: MODE_CHOICES,
  navLayout: NAV_LAYOUTS,
  outcome: OUTCOME_CLASSES,
  ownership: OWNERSHIPS,
  phase: AGENT_PHASE_SEQUENCE,
  'pilot.reason': PARCOURS_REASON_SEQUENCE,
  pilotPace: PILOT_PACE_SEQUENCE,
  pilotRunState: PILOT_RUN_STATE_SEQUENCE,
  pilotStepKind: PILOT_STEP_KIND_SEQUENCE,
  reviewPassState: REVIEW_PASS_STATE_SEQUENCE,
  role: ACCOUNT_ROLE_SEQUENCE,
  screen: SCREEN_SEQUENCE,
  state: STORY_STATE_SEQUENCE,
  storyKind: STORY_KIND_SEQUENCE,
  storyPart: PARTS,
  voice: REMARK_VOICE_SEQUENCE,
}
