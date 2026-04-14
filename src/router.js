import { createRouter, createWebHashHistory } from 'vue-router'
import { useReportStore } from './stores/report.js'

const routes = [
  { path: '/', name: 'upload', component: () => import('./views/UploadView.vue') },
  { path: '/summary', name: 'summary', component: () => import('./views/SummaryView.vue') },
  { path: '/sessions', name: 'sessions', component: () => import('./views/SessionsView.vue') },
  { path: '/sessions/:id', name: 'session-detail', component: () => import('./views/SessionDetailView.vue') },
  { path: '/prs', name: 'prs', component: () => import('./views/PrTrackerView.vue') },
  { path: '/tickets', name: 'tickets', component: () => import('./views/TicketsView.vue') },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

router.beforeEach((to) => {
  const { isLoaded } = useReportStore()

  if (to.name === 'upload' && isLoaded.value) {
    return { name: 'summary' }
  }

  if (to.name !== 'upload' && !isLoaded.value) {
    return { name: 'upload' }
  }
})

export default router
