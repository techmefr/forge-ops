import {
  applyDirection,
  detectLocale,
  interpolate,
  loadTranslations,
  persistLocale,
  translate,
} from './i18n.js'

const POLL_INTERVAL_MS = 1000

const tasksBody = document.getElementById('tasks-body')
const emptyState = document.getElementById('empty-state')
const lastRefresh = document.getElementById('last-refresh')
const localeSelect = document.getElementById('locale-select')
const appTitle = document.getElementById('app-title')

let currentTranslations = null
let currentLocale = detectLocale()

function applyStaticTranslations() {
  appTitle.textContent = translate(currentTranslations, 'title')
  document.title = `${translate(currentTranslations, 'title')} — Dashboard`
  for (const node of document.querySelectorAll('[data-i18n]')) {
    node.textContent = translate(currentTranslations, node.dataset.i18n)
  }
  localeSelect.value = currentLocale
}

function renderTasks(tasks) {
  tasksBody.innerHTML = ''
  emptyState.hidden = tasks.length > 0
  emptyState.textContent = translate(currentTranslations, 'emptyState')

  for (const task of tasks) {
    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${task.branch}</td>
      <td>${task.port}</td>
      <td><span class="status-badge status-${task.status}">${task.status}</span></td>
      <td>${task.lastCheckpoint ?? '—'}</td>
    `
    tasksBody.appendChild(row)
  }
}

async function refreshTasks() {
  try {
    const response = await fetch('/api/tasks')
    const tasks = await response.json()
    renderTasks(tasks)
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

localeSelect.addEventListener('change', (event) => {
  const locale = event.target.value
  persistLocale(locale)
  setLocale(locale)
})

async function main() {
  await setLocale(currentLocale)
  setInterval(refreshTasks, POLL_INTERVAL_MS)
}

main()
