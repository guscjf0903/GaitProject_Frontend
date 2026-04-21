import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { configureApi } from './api/config'
import { applyThemeMode } from './features/chat/composables/useChatUiState'

const app = createApp(App)
app.use(createPinia())
app.use(router)
configureApi()
applyThemeMode(localStorage.getItem('gitai_theme') === 'light' ? 'light' : 'dark')
app.mount('#app')
