import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SOURCE = resolve(process.cwd(), 'frontend/src')

const ALLOWED_MONO_USES: Readonly<Record<string, number>> = {
  'domain/Access/ConnectScreen.vue': 2,
  'domain/Access/LoginScreen.vue': 1,
  'domain/Board/ProjectCreateForm.vue': 2,
  'domain/Deployment/DeploymentScreen.vue': 3,
  'domain/File/FileBrowser.vue': 7,
  'domain/File/FileScreen.vue': 9,
  'domain/Forge/ForgeCardTile.vue': 1,
  'domain/Forge/ForgeDrawer.vue': 3,
  'domain/Incident/IncidentScreen.vue': 2,
  'domain/Pilot/PilotPanel.vue': 1,
  'domain/Project/NewProjectDialog.vue': 1,
  'domain/Resource/ResourceScreen.vue': 1,
  'domain/Setting/OrganisationSection.vue': 2,
  'domain/Setting/TemplateSection.vue': 3,
  'domain/Setting/UsersSection.vue': 2,
  'domain/Statistic/StatisticScreen.vue': 3,
  'domain/Story/StoryScreen.vue': 2,
  'domain/Story/StoryTicket.vue': 3,
  'domain/Subject/SubjectFormLinks.vue': 1,
  'domain/View/ViewScreen.vue': 2,
  'domain/Workflow/WorkflowStepCard.vue': 2,
}

function templatesUnder(folder: string): readonly string[] {
  return readdirSync(folder).flatMap((entry) => {
    const path = join(folder, entry)
    if (statSync(path).isDirectory()) {
      return templatesUnder(path)
    }
    return path.endsWith('.vue') ? [path] : []
  })
}

function monoUsesByFile(): Record<string, number> {
  const found: Record<string, number> = {}
  for (const path of templatesUnder(SOURCE)) {
    const count = (readFileSync(path, 'utf8').match(/\bfont-mono\b/g) ?? []).length
    if (count > 0) {
      found[relative(SOURCE, path).replaceAll('\\', '/')] = count
    }
  }
  return found
}

describe('monospace stays for ids, paths, codes and cost figures', () => {
  const found = monoUsesByFile()

  it('uses font-mono only in the allow-listed components', () => {
    expect(Object.keys(found).filter((file) => !(file in ALLOWED_MONO_USES))).toEqual([])
  })

  it('never uses it more often than the allow-list says', () => {
    const over = Object.entries(found).filter(([file, count]) => count > (ALLOWED_MONO_USES[file] ?? 0))
    expect(over).toEqual([])
  })

  it('keeps the allow-list honest when a use goes away', () => {
    const stale = Object.entries(ALLOWED_MONO_USES).filter(([file, count]) => (found[file] ?? 0) < count)
    expect(stale).toEqual([])
  })
})
