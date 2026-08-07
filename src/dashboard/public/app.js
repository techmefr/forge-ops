import {
  applyDirection,
  detectLocale,
  interpolate,
  loadTranslations,
  persistLocale,
  translate,
} from './i18n.js'

const POLL_INTERVAL_MS = 1000
const FONT_SCALE_KEY = 'starfleet_font_scale'
const THEME_KEY = 'starfleet_theme'
const DEFAULT_FONT_SCALE = '1'
const DEFAULT_THEME = 'auto'

const tasksBody = document.getElementById('tasks-body')
const emptyState = document.getElementById('empty-state')
const lastRefresh = document.getElementById('last-refresh')
const localeSelect = document.getElementById('locale-select')
const appTitle = document.getElementById('app-title')
const settingsBtn = document.getElementById('settings-btn')
const settingsPanel = document.getElementById('settings-panel')
const fontSizeSlider = document.getElementById('font-size-slider')
const themeGroup = document.getElementById('theme-group')
const refreshBtn = document.getElementById('refresh-btn')
const statsEl = document.getElementById('stats')
const searchInput = document.getElementById('search')
const statusFilter = document.getElementById('status-filter')
const projectFilter = document.getElementById('project-filter')
const createForm = document.getElementById('create-form')
const filtersEl = document.getElementById('filters')
const mainEl = document.querySelector('main')
const conflictsCount = document.getElementById('conflicts-count')

const TABS = {
  worktrees: { button: document.getElementById('tab-worktrees'), view: null, render: null },
  files: {
    button: document.getElementById('tab-files'),
    view: document.getElementById('files-view'),
    render: renderFiles,
  },
  conflicts: {
    button: document.getElementById('tab-conflicts'),
    view: document.getElementById('conflicts-view'),
    render: renderConflicts,
  },
  arch: {
    button: document.getElementById('tab-arch'),
    view: document.getElementById('arch-view'),
    render: renderArch,
  },
  activity: {
    button: document.getElementById('tab-activity'),
    view: document.getElementById('activity-view'),
    render: renderActivity,
  },
}

let currentTranslations = null
let currentLocale = detectLocale()
let allTasks = []
let currentTab = 'worktrees'

function applyStaticTranslations() {
  appTitle.textContent = translate(currentTranslations, 'title')
  document.title = `${translate(currentTranslations, 'title')} — Dashboard`
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = translate(currentTranslations, node.dataset.i18n)
  }
  refreshBtn.setAttribute('aria-label', translate(currentTranslations, 'refresh'))
  searchInput.setAttribute('placeholder', translate(currentTranslations, 'filter.search'))
  for (const name of ['project', 'branch', 'repoPath', 'runCommand', 'feature']) {
    createForm.elements[name].setAttribute('placeholder', translate(currentTranslations, `form.${name}`))
  }
  localeSelect.value = currentLocale
  const active = TABS[currentTab]
  if (active.render !== null) {
    active.render()
  }
}

async function apiGet(url, fallback) {
  try {
    const response = await fetch(url)
    const payload = await response.json()
    return payload?.data ?? payload ?? fallback
  } catch (error) {
    return fallback
  }
}

async function renderArch() {
  const t = (key) => translate(currentTranslations, key)
  const archView = TABS.arch.view
  const nodes = await apiGet('/api/arch', [])
  if (nodes.length === 0) {
    archView.innerHTML = `<p class="arch-empty">${t('arch.empty')}</p>`
    return
  }
  const byProject = new Map()
  for (const node of nodes) {
    if (!byProject.has(node.project)) {
      byProject.set(node.project, [])
    }
    byProject.get(node.project).push(node)
  }
  archView.innerHTML = [...byProject.keys()]
    .sort()
    .map((project) => {
      const rows = byProject
        .get(project)
        .map(
          (n) => `<div class="arch-node">
            <code class="arch-path">${escapeHtml(n.path)}</code>
            <span class="arch-purpose">${n.purpose ? escapeHtml(n.purpose) : '—'}</span>
            <span class="chip arch-${n.status}">${t(`archStatus.${n.status}`)}</span>
          </div>`,
        )
        .join('')
      return `<div class="arch-group" style="--chip-h:${hueFor(project)}">
        <div class="arch-group-head">${projectChip(project)}<span class="group-name">${escapeHtml(project)}</span></div>
        <div class="arch-list">${rows}</div>
      </div>`
    })
    .join('')
}

const FILE_STATES = ['in_progress', 'touched', 'planned']

function stateChip(state) {
  const label = translate(currentTranslations, `fileStates.${state}`)
  const help = translate(currentTranslations, `fileStatesHelp.${state}`)
  return `<span class="chip file-state file-${state}" title="${escapeHtml(help)}">${escapeHtml(label)}</span>`
}

// Les trois niveaux de certitude ne sont jamais fondus dans une colonne : une
// colonne par niveau, un fichier prevu ne se lit pas comme un fichier ecrit.
async function renderFiles() {
  const t = (key) => translate(currentTranslations, key)
  const filesView = TABS.files.view
  const rows = await apiGet('/api/files', [])
  if (rows.length === 0) {
    filesView.innerHTML = `<p class="arch-empty">${t('files.empty')}</p>`
    return
  }
  const legend = FILE_STATES.map(stateChip).join('')
  const body = rows
    .map((row) => {
      const owners = row.owners
        .map(
          (owner) =>
            `<span class="file-owner" title="${escapeHtml(owner.worktreePath ?? '—')}">${escapeHtml(owner.branch)}${stateChip(owner.state)}</span>`,
        )
        .join('')
      const shared = row.shared ? `<span class="chip chip-shared">${t('files.shared')}</span>` : ''
      return `<tr style="--chip-h:${hueFor(row.project)}">
        <td data-label="${t('columns.project')}">${projectChip(row.project)}</td>
        <td data-label="${t('files.path')}"><code class="arch-path">${escapeHtml(row.path)}</code>${shared}</td>
        <td data-label="${t('files.owners')}" class="file-owners">${owners}</td>
      </tr>`
    })
    .join('')
  filesView.innerHTML = `<p class="view-legend">${t('files.legend')} ${legend}</p>
    <div class="table-card"><table class="sub-table sub-files">
      <thead><tr><th>${t('columns.project')}</th><th>${t('files.path')}</th><th>${t('files.owners')}</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`
}

async function renderConflicts(rescan = false) {
  const t = (key) => translate(currentTranslations, key)
  const conflictsView = TABS.conflicts.view
  if (rescan) {
    await fetch('/api/conflicts/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }).catch(() => null)
  }
  const conflicts = await apiGet('/api/conflicts', [])
  refreshConflictsBadge(conflicts.length)
  const scanButton = `<button type="button" id="rescan-btn" class="mini-btn">${t('conflicts.rescan')}</button>`
  if (conflicts.length === 0) {
    conflictsView.innerHTML = `<p class="view-legend">${t('conflicts.explain')} ${scanButton}</p>
      <p class="arch-empty">${t('conflicts.empty')}</p>`
    return
  }
  const body = conflicts
    .map((conflict) => {
      const arbitration =
        conflict.arbitration === null
          ? `<span class="col-muted">${t('conflicts.devDecides')}</span>`
          : escapeHtml(conflict.arbitration)
      const promoted = conflict.promoted
        ? `<span class="chip file-in_progress" title="${escapeHtml(t('conflicts.promotedHelp'))}">${t('conflicts.promoted')}</span>`
        : `<span class="chip file-planned" title="${escapeHtml(t('conflicts.watchedHelp'))}">${t('conflicts.watched')}</span>`
      return `<tr style="--chip-h:${hueFor(conflict.project)}">
        <td data-label="${t('columns.project')}">${projectChip(conflict.project)}</td>
        <td data-label="${t('conflicts.branches')}">${escapeHtml(conflict.leftBranch)} ↔ ${escapeHtml(conflict.rightBranch)}</td>
        <td data-label="${t('files.path')}"><code class="arch-path">${escapeHtml(conflict.filePath)}</code></td>
        <td data-label="${t('conflicts.state')}">${promoted}</td>
        <td data-label="${t('conflicts.arbitration')}">${arbitration}</td>
      </tr>`
    })
    .join('')
  conflictsView.innerHTML = `<p class="view-legend">${t('conflicts.explain')} ${scanButton}</p>
    <div class="table-card"><table class="sub-table sub-conflicts">
      <thead><tr>
        <th>${t('columns.project')}</th><th>${t('conflicts.branches')}</th><th>${t('files.path')}</th>
        <th>${t('conflicts.state')}</th><th>${t('conflicts.arbitration')}</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table></div>`
}

async function renderActivity() {
  const t = (key) => translate(currentTranslations, key)
  const activityView = TABS.activity.view
  const events = await apiGet('/api/activity?limit=100', [])
  if (events.length === 0) {
    activityView.innerHTML = `<p class="arch-empty">${t('activity.empty')}</p>`
    return
  }
  const body = events
    .map(
      (event) => `<tr style="--chip-h:${hueFor(event.project ?? '?')}">
        <td data-label="${t('columns.updated')}" class="col-muted col-nowrap">${formatDate(event.createdAt)}</td>
        <td data-label="${t('columns.project')}">${event.project === null ? '—' : projectChip(event.project)}</td>
        <td data-label="${t('columns.branch')}">${escapeHtml(event.branch ?? '—')}</td>
        <td data-label="${t('activity.tool')}">${escapeHtml(event.tool)}</td>
        <td data-label="${t('files.path')}"><code class="arch-path">${escapeHtml(event.filePath ?? '—')}</code></td>
      </tr>`,
    )
    .join('')
  activityView.innerHTML = `<p class="view-legend">${t('activity.explain')}</p>
    <div class="table-card"><table class="sub-table sub-activity">
      <thead><tr>
        <th>${t('columns.updated')}</th><th>${t('columns.project')}</th><th>${t('columns.branch')}</th>
        <th>${t('activity.tool')}</th><th>${t('files.path')}</th>
      </tr></thead>
      <tbody>${body}</tbody>
    </table></div>`
}

function refreshConflictsBadge(count) {
  conflictsCount.hidden = count === 0
  conflictsCount.textContent = String(count)
}

function setTab(tab) {
  currentTab = tab
  for (const [name, entry] of Object.entries(TABS)) {
    entry.button.classList.toggle('is-active', name === tab)
    if (entry.view !== null) {
      entry.view.hidden = name !== tab
    }
  }
  const worktrees = tab === 'worktrees'
  filtersEl.hidden = !worktrees
  mainEl.hidden = !worktrees
  const active = TABS[tab]
  if (active.render !== null) {
    active.render()
  }
}

async function apiPost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    window.alert(payload.detail ?? payload.error ?? `Erreur ${response.status}`)
  }
  await refreshTasks()
}

function renderStats(tasks) {
  const projects = new Set(tasks.map((task) => task.project)).size
  const online = tasks.filter((task) => task.live).length
  const escalated = tasks.filter((task) => task.status === 'escalated').length
  const review = tasks.filter((task) => task.status === 'awaiting_human').length
  const tiles = [
    { value: projects, label: translate(currentTranslations, 'stats.projects'), hue: 250 },
    { value: tasks.length, label: translate(currentTranslations, 'stats.worktrees'), hue: 211 },
    { value: online, label: translate(currentTranslations, 'online'), hue: 120 },
    { value: escalated, label: translate(currentTranslations, 'stats.escalated'), hue: 1 },
    { value: review, label: translate(currentTranslations, 'stats.review'), hue: 16 },
  ]
  statsEl.innerHTML = tiles
    .map(
      (tile) =>
        `<div class="stat" style="--chip-h:${tile.hue}"><span class="stat-value">${tile.value}</span><span class="stat-label">${tile.label}</span></div>`,
    )
    .join('')
}

function populateProjectFilter() {
  const projects = [...new Set(allTasks.map((task) => task.project))].sort()
  const signature = `${currentLocale}|${projects.join('|')}`
  if (projectFilter.dataset.sig === signature) {
    return
  }
  projectFilter.dataset.sig = signature
  const current = projectFilter.value
  const allLabel = translate(currentTranslations, 'filter.allProjects')
  projectFilter.innerHTML =
    `<option value="">${allLabel}</option>` +
    projects.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')
  if (projects.includes(current)) {
    projectFilter.value = current
  }
}

function applyAndRender() {
  populateProjectFilter()
  const query = searchInput.value.trim().toLowerCase()
  const status = statusFilter.value
  const project = projectFilter.value
  const filtered = allTasks.filter((task) => {
    const matchStatus = status === '' || task.status === status
    const matchProject = project === '' || task.project === project
    const haystack = `${task.project} ${task.branch} ${task.feature ?? ''}`.toLowerCase()
    return matchStatus && matchProject && (query === '' || haystack.includes(query))
  })
  renderStats(allTasks)
  renderTasks(filtered)
}

function formatDate(value) {
  if (value === null) {
    return '—'
  }
  return new Date(`${value}Z`).toLocaleString(currentLocale)
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (char) => {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]
  })
}

// Teintes derivees de la palette categorielle validee (dataviz), ordre CVD-safe :
// bleu, aqua, jaune, vert, violet, rouge, magenta, orange.
const CATEGORICAL_HUES = [211, 160, 41, 120, 250, 1, 340, 16]

// La couleur suit le projet (stable par nom, jamais recyclee arbitrairement) :
// on mappe le nom vers un slot fixe de la palette plutot que de generer une teinte.
function hueFor(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  }
  return CATEGORICAL_HUES[hash % CATEGORICAL_HUES.length]
}

function projectChip(project) {
  return `<span class="chip chip-project" style="--chip-h:${hueFor(project)}">${escapeHtml(project)}</span>`
}

function featureCell(task) {
  const role = task.role ? `<span class="chip role-${escapeHtml(task.role)}">${escapeHtml(task.role)}</span>` : ''
  const feature = task.feature ? `<span class="feature-name">${escapeHtml(task.feature)}</span>` : ''
  return role || feature ? `${role}${feature}` : '—'
}

function notesCell(task) {
  if (task.escalationReason !== null) {
    return `<span class="notes notes-escalated" title="${escapeHtml(task.escalationReason)}">⚠ ${escapeHtml(task.escalationReason)}</span>`
  }
  if (task.contextSummary !== null) {
    return `<span class="notes" title="${escapeHtml(task.contextSummary)}">${escapeHtml(task.contextSummary)}</span>`
  }
  return '—'
}

function liveDot(task) {
  const label = translate(currentTranslations, task.live ? 'online' : 'offline')
  const cls = task.live ? 'live-dot is-live' : 'live-dot'
  return `<span class="${cls}" title="${label}" aria-label="${label}"></span>`
}

function itemsPanel(task) {
  const items = task.items ?? []
  const list = items
    .map(
      (item) =>
        `<label class="item"><input type="checkbox" data-item-id="${item.id}" ${item.done ? 'checked' : ''} /> <span class="${item.done ? 'item-done' : ''}">${escapeHtml(item.label)}</span></label>`,
    )
    .join('')
  return `<div class="items" data-project="${escapeHtml(task.project)}" data-branch="${escapeHtml(task.branch)}">
    ${list}
    <button type="button" class="mini-btn" data-action="add-item">＋</button>
  </div>`
}

// Icones Lucide (ISC) inline en SVG stroke — pas d'emoji/glyphe comme icone.
const ICONS = {
  open: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  launch: '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  start: '<polygon points="6 3 20 12 6 21 6 3"/>',
  stop: '<rect x="3" y="3" width="18" height="18" rx="2"/>',
  escalate: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  cleanup: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
}

function svg(name) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
}

function actionsCell(task) {
  const t = (key) => translate(currentTranslations, key)
  const help = (key) => translate(currentTranslations, `actionsHelp.${key}`)
  const btn = (name, action, label, title, danger) =>
    `<button type="button" class="icon-btn${danger ? ' danger' : ''}" data-action="${action}" title="${escapeHtml(title)}" aria-label="${label}">${svg(name)}</button>`
  const parts = [
    `<a class="icon-btn" href="${escapeHtml(task.url)}" target="_blank" rel="noopener" title="${escapeHtml(`${help('open')} — ${task.url}`)}" aria-label="${t('actions.open')}">${svg('open')}</a>`,
  ]
  if (task.worktreePath === null && task.repoPath !== null) {
    parts.push(btn('launch', 'launch', t('actions.launch'), help('launch')))
  }
  if (task.pid !== null) {
    parts.push(btn('stop', 'stop', t('actions.stop'), `${help('stop')} (pid ${task.pid})`))
  } else if (task.runCommand !== null) {
    parts.push(btn('start', 'start', t('actions.start'), `${help('start')} (${task.runCommand})`))
  }
  parts.push(btn('escalate', 'escalate', t('actions.escalate'), help('escalate')))
  parts.push(btn('cleanup', 'cleanup', t('actions.cleanup'), help('cleanup'), true))
  return `<div class="actions" data-project="${escapeHtml(task.project)}" data-branch="${escapeHtml(task.branch)}">${parts.join('')}</div>`
}

// Explication de l'etat au survol (title) — « escaladee » n'est pas evident.
function statusTitle(task) {
  const base = translate(currentTranslations, `statuses.${task.status}`)
  if (task.status === 'escalated' && task.escalationReason) {
    return `${base} — ${task.escalationReason}`
  }
  if (task.status === 'in_progress' && task.lastCheckpoint) {
    return `${base} (${task.lastCheckpoint})`
  }
  return base
}

function tasksCount(task) {
  const items = task.items ?? []
  if (items.length === 0) {
    return '—'
  }
  const done = items.filter((i) => i.done).length
  const list = items.map((i) => `${i.done ? '✓' : '○'} ${i.label}`).join('\n')
  return `<span class="tasks-count" title="${escapeHtml(list)}">☑ ${done}/${items.length}</span>`
}

function rowInner(task) {
  const label = (key) => translate(currentTranslations, `columns.${key}`)
  return `
    <td data-label="${label('project')}">${projectChip(task.project)}</td>
    <td data-label="${label('branch')}" class="col-ellipsis" title="${escapeHtml(task.branch)}">${escapeHtml(task.branch)}</td>
    <td data-label="${label('feature')}" class="col-feature">${featureCell(task)}</td>
    <td data-label="${label('port')}" class="col-port">${task.port}</td>
    <td data-label="${label('status')}" class="col-status"><span class="status-badge status-${task.status}" title="${escapeHtml(statusTitle(task))}">${liveDot(task)}${task.status}</span></td>
    <td data-label="${label('checkpoint')}" class="col-muted col-nowrap">${task.lastCheckpoint ?? '—'}</td>
    <td data-label="${label('tasks')}" class="col-nowrap">${tasksCount(task)}</td>
    <td data-label="${label('updated')}" class="col-muted col-nowrap">${formatDate(task.updatedAt)}</td>
    <td data-label="${label('notes')}" class="col-notes">${notesCell(task)}</td>
    <td class="col-actions">${actionsCell(task)}</td>`
}

// Le flex vit sur un div interne : un td en display:flex cesse d'etre une
// cellule de tableau, son colspan est ignore et l'en-tete se retrouve enferme
// dans la premiere colonne.
function groupHeaderInner(project, count) {
  return `<td class="group-cell" colspan="10"><div class="group-inner">${projectChip(project)}<span class="group-name">${escapeHtml(project)}</span><span class="group-count">${count}</span></div></td>`
}

// Regroupe par projet (en-tete de section + lignes), puis mise a jour
// differentielle : on ne touche que ce qui change, on preserve l'ordre, pas de
// rebuild total chaque seconde (flicker, perte du survol/focus).
function renderTasks(tasks) {
  emptyState.hidden = tasks.length > 0
  emptyState.textContent = translate(currentTranslations, 'emptyState')

  const byProject = new Map()
  for (const task of tasks) {
    if (!byProject.has(task.project)) {
      byProject.set(task.project, [])
    }
    byProject.get(task.project).push(task)
  }
  const items = []
  for (const project of [...byProject.keys()].sort()) {
    const group = byProject.get(project)
    items.push({ key: `group::${project}`, group: true, project, count: group.length })
    for (const task of group) {
      items.push({ key: `${task.project}::${task.branch}`, task })
    }
  }

  const existing = new Map()
  for (const el of tasksBody.children) {
    existing.set(el.dataset.key, el)
  }

  const used = new Set()
  let previous = null
  for (const item of items) {
    used.add(item.key)
    const html = item.group ? groupHeaderInner(item.project, item.count) : rowInner(item.task)
    let row = existing.get(item.key)
    if (row === undefined) {
      row = document.createElement('tr')
      row.dataset.key = item.key
      if (item.group) {
        row.className = 'group-row'
      }
    }
    if (row.dataset.sig !== html) {
      row.innerHTML = html
      row.dataset.sig = html
      row.style.setProperty('--chip-h', hueFor(item.group ? item.project : item.task.project))
    }
    const anchor = previous === null ? tasksBody.firstChild : previous.nextSibling
    if (anchor !== row) {
      tasksBody.insertBefore(row, anchor)
    }
    previous = row
  }

  for (const [key, el] of existing) {
    if (!used.has(key)) {
      el.remove()
    }
  }
}

async function refreshTasks() {
  try {
    const response = await fetch('/api/tasks')
    allTasks = await response.json()
    applyAndRender()
    lastRefresh.textContent = interpolate(translate(currentTranslations, 'lastRefresh'), {
      time: new Date().toLocaleTimeString(currentLocale),
    })
  } catch (error) {
    lastRefresh.textContent = translate(currentTranslations, 'connectionLost')
  }
}

async function setLocale(locale) {
  currentLocale = locale
  currentTranslations = await loadTranslations(locale)
  applyDirection(locale)
  applyStaticTranslations()
  await refreshTasks()
}

function markActive(group, matches) {
  for (const button of group.querySelectorAll('button')) {
    button.classList.toggle('is-active', matches(button))
  }
}

function applyFontScale(scale) {
  document.documentElement.style.setProperty('--font-scale', scale)
  fontSizeSlider.value = scale
}

function applyTheme(theme) {
  if (theme === 'auto') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  markActive(themeGroup, (button) => button.dataset.themeChoice === theme)
}

function toggleSettings(open) {
  const shouldOpen = open ?? settingsPanel.hidden
  settingsPanel.hidden = !shouldOpen
  settingsBtn.setAttribute('aria-expanded', String(shouldOpen))
}

localeSelect.addEventListener('change', (event) => {
  persistLocale(event.target.value)
  setLocale(event.target.value)
})

fontSizeSlider.addEventListener('input', (event) => {
  localStorage.setItem(FONT_SCALE_KEY, event.target.value)
  document.documentElement.style.setProperty('--font-scale', event.target.value)
})

themeGroup.addEventListener('click', (event) => {
  const button = event.target.closest('button')
  if (button === null) {
    return
  }
  localStorage.setItem(THEME_KEY, button.dataset.themeChoice)
  applyTheme(button.dataset.themeChoice)
})

refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('is-spinning')
  refreshTasks().finally(() => {
    setTimeout(() => refreshBtn.classList.remove('is-spinning'), 400)
  })
})

searchInput.addEventListener('input', applyAndRender)
statusFilter.addEventListener('change', applyAndRender)
projectFilter.addEventListener('change', applyAndRender)
for (const [name, entry] of Object.entries(TABS)) {
  entry.button.addEventListener('click', () => setTab(name))
}

TABS.conflicts.view.addEventListener('click', (event) => {
  if (event.target.closest('#rescan-btn') !== null) {
    renderConflicts(true)
  }
})

createForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const body = {}
  for (const [key, value] of new FormData(createForm).entries()) {
    if (value) {
      body[key] = value
    }
  }
  await apiPost('/api/tasks', body)
  createForm.reset()
  const details = createForm.closest('details')
  if (details) {
    details.open = false
  }
})

tasksBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]')
  if (button === null) {
    return
  }
  const holder = button.closest('[data-project]')
  if (holder === null) {
    return
  }
  const project = holder.dataset.project
  const branch = holder.dataset.branch
  switch (button.dataset.action) {
    case 'launch':
      await apiPost('/api/worktree/launch', { project, branch })
      break
    case 'start':
      await apiPost('/api/server/start', { project, branch })
      break
    case 'stop':
      await apiPost('/api/server/stop', { project, branch })
      break
    case 'escalate': {
      const reason = window.prompt(translate(currentTranslations, 'actions.escalateReason'))
      if (reason) {
        await apiPost('/api/escalate', { project, branch, reason })
      }
      break
    }
    case 'cleanup':
      if (window.confirm(translate(currentTranslations, 'actions.cleanupConfirm'))) {
        await apiPost('/api/cleanup', { project, branch })
      }
      break
    case 'add-item': {
      const label = window.prompt(translate(currentTranslations, 'actions.addItemLabel'))
      if (label) {
        await apiPost('/api/task-items', { project, branch, label })
      }
      break
    }
  }
})

tasksBody.addEventListener('change', async (event) => {
  const checkbox = event.target.closest('input[data-item-id]')
  if (checkbox === null) {
    return
  }
  await fetch(`/api/task-items/${checkbox.dataset.itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: checkbox.checked }),
  })
  await refreshTasks()
})

settingsBtn.addEventListener('click', (event) => {
  event.stopPropagation()
  toggleSettings()
})

settingsPanel.addEventListener('click', (event) => {
  event.stopPropagation()
})

document.addEventListener('click', () => {
  if (!settingsPanel.hidden) {
    toggleSettings(false)
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    toggleSettings(false)
  }
})

// L'etat git se recalcule cote serveur a chaque lecture : on le redemande moins
// souvent que la liste des taches, pour ne pas repasser sur toutes les worktrees
// chaque seconde ni faire clignoter le tableau ouvert.
const DERIVED_EVERY_TICKS = 5
let tick = 0

async function poll() {
  await refreshTasks()
  tick += 1
  if (tick % DERIVED_EVERY_TICKS !== 0) {
    return
  }
  const conflicts = await apiGet('/api/conflicts', [])
  refreshConflictsBadge(conflicts.length)
  const active = TABS[currentTab]
  if (currentTab !== 'worktrees' && active.render !== null) {
    await active.render()
  }
}

async function main() {
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY) ?? DEFAULT_FONT_SCALE)
  applyTheme(localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME)
  await setLocale(currentLocale)
  refreshConflictsBadge((await apiGet('/api/conflicts', [])).length)
  setInterval(poll, POLL_INTERVAL_MS)
}

main()
