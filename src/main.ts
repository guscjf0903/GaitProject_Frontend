import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { configureApi } from './api/config'

const app = createApp(App)
app.use(createPinia())
app.use(router)
configureApi()
app.mount('#app')
