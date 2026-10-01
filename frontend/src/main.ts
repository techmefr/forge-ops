import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createBoardRouter } from './composition/BoardRouter'
import { isDesktop } from './technical/Api/Addresses'
import { LOGIN_PATH, setLoginRedirect } from './technical/Api/Board'
import { desktopTokenVault } from './technical/Api/DesktopTokenVault'
import { secureTokens } from './technical/Api/Servers'
import { boardI18n } from './technical/Language/I18n'
import { startLanguage } from './technical/Language/UseLanguage'
import './style.css'

startLanguage()

const router = createBoardRouter()
setLoginRedirect(() => void router.push(LOGIN_PATH))

async function start(): Promise<void> {
  if (isDesktop()) {
    await secureTokens(window.localStorage, desktopTokenVault)
  }
  createApp(App).use(createPinia()).use(boardI18n).use(router).mount('#app')
}

void start()
