import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/app.css'

import { theme } from './stores/theme'
theme.init()

createApp(App).use(router).mount('#app')
