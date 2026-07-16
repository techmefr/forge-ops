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

let currentTranslations = null
let currentLocale = detectLocale()
let allTasks = []

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
  const btn = (name, action, label, danger) =>
    `<button type="button" class="icon-btn${danger ? ' danger' : ''}" data-action="${action}" title="${label}" aria-label="${label}">${svg(name)}</button>`
  const parts = [
    `<a class="icon-btn" href="${escapeHtml(task.url)}" target="_blank" rel="noopener" title="${t('actions.open')}" aria-label="${t('actions.open')}">${svg('open')}</a>`,
  ]
  if (task.worktreePath === null && task.repoPath !== null) {
    parts.push(btn('launch', 'launch', t('actions.launch')))
  }
  if (task.pid !== null) {
    parts.push(btn('stop', 'stop', t('actions.stop')))
  } else if (task.runCommand !== null) {
    parts.push(btn('start', 'start', t('actions.start')))
  }
  parts.push(btn('escalate', 'escalate', t('actions.escalate')))
  parts.push(btn('cleanup', 'cleanup', t('actions.cleanup'), true))
  return `<div class="actions" data-project="${escapeHtml(task.project)}" data-branch="${escapeHtml(task.branch)}">${parts.join('')}</div>`
}

function metaCell(labelKey, value) {
  return `<div><dt>${translate(currentTranslations, `columns.${labelKey}`)}</dt><dd>${value}</dd></div>`
}

function cardInner(task) {
  const chips = task.feature || task.role ? `<div class="card-chips">${featureCell(task)}</div>` : ''
  const notes =
    task.escalationReason !== null || task.contextSummary !== null
      ? `<div class="card-notes">${notesCell(task)}</div>`
      : ''
  return `
      <div class="card-top">
        ${projectChip(task.project)}
        <span class="status-badge status-${task.status}">${liveDot(task)}${task.status}</span>
      </div>
      <div class="card-branch">${escapeHtml(task.branch)}</div>
      ${chips}
      <dl class="card-meta">
        ${metaCell('port', task.port)}
        ${metaCell('checkpoint', task.lastCheckpoint ?? '—')}
        ${metaCell('updated', formatDate(task.updatedAt))}
      </dl>
      <div class="card-tasks">${itemsPanel(task)}</div>
      ${notes}
      <div class="card-foot">${actionsCell(task)}</div>`
}

// Mise a jour differentielle : on ne touche que les cards qui changent, on
// ajoute les nouvelles (avec animation d'entree), on retire les disparues, on
// preserve l'ordre. Evite le rebuild total chaque seconde (flicker, perte du
// survol/focus) et ne rejoue l'animation que sur les vraies nouvelles cards.
function renderTasks(tasks) {
  emptyState.hidden = tasks.length > 0
  emptyState.textContent = translate(currentTranslations, 'emptyState')

  const existing = new Map()
  for (const el of tasksBody.children) {
    existing.set(el.dataset.key, el)
  }

  const used = new Set()
  let previous = null
  let newIndex = 0
  for (const task of tasks) {
    const key = `${task.project}::${task.branch}`
    used.add(key)
    const html = cardInner(task)
    let card = existing.get(key)
    if (card === undefined) {
      card = document.createElement('article')
      card.className = 'card card--enter'
      card.dataset.key = key
      card.style.animationDelay = `${newIndex * 45}ms`
      newIndex += 1
    }
    if (card.dataset.sig !== html) {
      card.innerHTML = html
      card.dataset.sig = html
      card.style.setProperty('--chip-h', hueFor(task.project))
    }
    const anchor = previous === null ? tasksBody.firstChild : previous.nextSibling
    if (anchor !== card) {
      tasksBody.insertBefore(card, anchor)
    }
    previous = card
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

async function main() {
  applyFontScale(localStorage.getItem(FONT_SCALE_KEY) ?? DEFAULT_FONT_SCALE)
  applyTheme(localStorage.getItem(THEME_KEY) ?? DEFAULT_THEME)
  await setLocale(currentLocale)
  setInterval(refreshTasks, POLL_INTERVAL_MS)
}

main()
