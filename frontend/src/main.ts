import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { createBoardRouter } from './technical/Router/Router'
import './style.css'

createApp(App).use(createPinia()).use(createBoardRouter()).mount('#app')
