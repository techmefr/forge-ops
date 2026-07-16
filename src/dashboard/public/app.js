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
  localeSelect.value = currentLocale
}

function renderStats(tasks) {
  const projects = new Set(tasks.map((task) => task.project)).size
  const online = tasks.filter((task) => task.live).length
  const escalated = tasks.filter((task) => task.status === 'escalated').length
  const review = tasks.filter((task) => task.status === 'awaiting_human').length
  const tiles = [
    { value: projects, label: translate(currentTranslations, 'stats.projects') },
    { value: tasks.length, label: translate(currentTranslations, 'stats.worktrees') },
    { value: online, label: translate(currentTranslations, 'online') },
    { value: escalated, label: translate(currentTranslations, 'stats.escalated') },
    { value: review, label: translate(currentTranslations, 'stats.review') },
  ]
  statsEl.innerHTML = tiles
    .map(
      (tile) =>
        `<div class="stat"><span class="stat-value">${tile.value}</span><span class="stat-label">${tile.label}</span></div>`,
    )
    .join('')
}

function applyAndRender() {
  const query = searchInput.value.trim().toLowerCase()
  const status = statusFilter.value
  const filtered = allTasks.filter((task) => {
    const matchStatus = status === '' || task.status === status
    const haystack = `${task.project} ${task.branch} ${task.feature ?? ''}`.toLowerCase()
    return matchStatus && (query === '' || haystack.includes(query))
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

function tasksCell(task) {
  const items = task.items ?? []
  if (items.length === 0) {
    return '—'
  }
  const done = items.filter((item) => item.done).length
  const list = items.map((item) => `${item.done ? '✓' : '○'} ${item.label}`).join('\n')
  return `<span class="tasks-count" title="${escapeHtml(list)}">${done}/${items.length}</span>`
}

function openCell(task) {
  const label = translate(currentTranslations, 'columns.open')
  return `<a class="open-link" href="${escapeHtml(task.url)}" target="_blank" rel="noopener">${label} ↗</a>`
}

function renderTasks(tasks) {
  tasksBody.innerHTML = ''
  emptyState.hidden = tasks.length > 0
  emptyState.textContent = translate(currentTranslations, 'emptyState')

  const label = (key) => translate(currentTranslations, `columns.${key}`)
  for (const task of tasks) {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td data-label="${label('project')}">${escapeHtml(task.project)}</td>
      <td data-label="${label('branch')}">${escapeHtml(task.branch)}</td>
      <td data-label="${label('feature')}" class="col-muted">${task.feature ? escapeHtml(task.feature) : '—'}</td>
      <td data-label="${label('port')}" class="col-port">${task.port}</td>
      <td data-label="${label('status')}" class="col-status">${liveDot(task)}<span class="status-badge status-${task.status}">${task.status}</span></td>
      <td data-label="${label('checkpoint')}" class="col-muted col-nowrap">${task.lastCheckpoint ?? '—'}</td>
      <td data-label="${label('tasks')}" class="col-muted col-nowrap">${tasksCell(task)}</td>
      <td data-label="${label('updated')}" class="col-muted col-nowrap">${formatDate(task.updatedAt)}</td>
      <td data-label="${label('notes')}" class="col-notes">${notesCell(task)}</td>
      <td class="col-open">${openCell(task)}</td>
    `
    tasksBody.appendChild(row)
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
