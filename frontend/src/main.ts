import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createBoardRouter } from './composition/BoardRouter'
import { boardI18n } from './technical/Language/I18n'
import { startLanguage } from './technical/Language/UseLanguage'
import './style.css'

startLanguage()

createApp(App).use(createPinia()).use(boardI18n).use(createBoardRouter()).mount('#app')
