import { createApp } from 'vue'
import App from './App.vue'
import router from './router.js'
import { useReportStore } from './stores/report.js'
import './assets/main.css'

const app = createApp(App)
app.use(router)

// Auto-load from localStorage
const { loadFromStorage } = useReportStore()
loadFromStorage()

app.mount('#app')
