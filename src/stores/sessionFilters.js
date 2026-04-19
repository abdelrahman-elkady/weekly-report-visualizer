import { reactive, computed, watch } from 'vue'
import { isHighIdleRatio, utcDateKey } from '../utils/format.js'
import { useReportStore } from './report.js'

const DEFAULTS = {
  search: '',
  hasPR: 'any',
  hasJira: 'any',
  highIdle: 'any',
  minDuration: 0,
  maxDuration: 300,
  dateRange: 'any',
  tools: [],
  sort: 'createdAt',
}

const state = reactive({ ...DEFAULTS, tools: [] })

function resetAll() {
  Object.assign(state, DEFAULTS, { tools: [] })
}

const { reportData } = useReportStore()
watch(reportData, resetAll)

function activeCount(categoriesSize, reposSize, hasSpecificDate) {
  let c = 0
  if (state.search) c++
  if (categoriesSize) c += categoriesSize
  if (reposSize) c += reposSize
  if (state.hasPR !== 'any') c++
  if (state.hasJira !== 'any') c++
  if (state.highIdle !== 'any') c++
  if (state.minDuration > 0 || state.maxDuration < 300) c++
  if (state.dateRange !== 'any') c++
  if (state.tools.length) c += state.tools.length
  if (hasSpecificDate) c++
  return c
}

function applyFilters(sessions, opts) {
  const { categories, repos, date } = opts
  let result = sessions

  const q = state.search.trim().toLowerCase()
  if (q) {
    result = result.filter(s =>
      s.firstPromptShort?.toLowerCase().includes(q) ||
      s.gitBranch?.toLowerCase().includes(q) ||
      s.sessionId?.toLowerCase().includes(q) ||
      s.repo?.toLowerCase().includes(q) ||
      s.repoShort?.toLowerCase().includes(q)
    )
  }
  if (categories?.size) result = result.filter(s => categories.has(s.category))
  if (repos?.size) result = result.filter(s => repos.has(s.repoShort) || repos.has(s.repo))
  if (date) result = result.filter(s => utcDateKey(s.createdAt) === date)
  if (state.hasPR === 'yes') result = result.filter(s => (s.correlatedPRs?.length || 0) > 0)
  if (state.hasPR === 'no') result = result.filter(s => (s.correlatedPRs?.length || 0) === 0)
  if (state.hasJira === 'yes') result = result.filter(s => (s.jiraIds?.length || 0) > 0)
  if (state.hasJira === 'no') result = result.filter(s => (s.jiraIds?.length || 0) === 0)
  if (state.highIdle === 'yes') result = result.filter(s => isHighIdleRatio(s.durationMin, s.activeDurationMin))
  if (state.highIdle === 'no') result = result.filter(s => !isHighIdleRatio(s.durationMin, s.activeDurationMin))
  if (state.minDuration > 0) result = result.filter(s => (s.activeDurationMin ?? 0) >= state.minDuration)
  if (state.maxDuration < 300) result = result.filter(s => (s.activeDurationMin ?? 0) <= state.maxDuration)
  if (state.tools.length) {
    result = result.filter(s => state.tools.every(t => (s.toolCounts?.[t] || 0) > 0))
  }
  if (state.dateRange !== 'any') {
    const days = state.dateRange === 'today' ? 1 : state.dateRange === '7d' ? 7 : 30
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    result = result.filter(s => s.createdAt >= cutoff)
  }

  const key = state.sort
  result = [...result].sort((a, b) => {
    if (key === 'durationMin') return (b.activeDurationMin || 0) - (a.activeDurationMin || 0)
    if (key === 'createdAt') return (b.createdAt || '').localeCompare(a.createdAt || '')
    if (key === 'correlation') return (b.correlatedPRs?.length || 0) - (a.correlatedPRs?.length || 0)
    return 0
  })
  return result
}

function queryParamAsSet(query, key) {
  const val = query[key]
  if (!val) return new Set()
  return new Set(Array.isArray(val) ? val : [val])
}

export function useUrlFacets(route) {
  const activeCategories = computed(() => queryParamAsSet(route.query, 'category'))
  const activeRepos = computed(() => queryParamAsSet(route.query, 'repo'))
  const activeDate = computed(() => {
    const val = route.query.date
    return Array.isArray(val) ? val[0] : (val || '')
  })
  const filteredSessions = (sessions) =>
    applyFilters(sessions, {
      categories: activeCategories.value,
      repos: activeRepos.value,
      date: activeDate.value,
    })
  return { activeCategories, activeRepos, activeDate, filteredSessions }
}

export function useSessionFilters() {
  return { state, resetAll, applyFilters, activeCount }
}
