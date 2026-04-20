import { reactive, computed, watch } from 'vue'
import { useReportStore } from './report.js'

const DEFAULTS = {
  search: '',
  sort: 'mergedAt',
}

const state = reactive({ ...DEFAULTS })

function resetAll() {
  Object.assign(state, DEFAULTS)
}

const { reportData } = useReportStore()
watch(reportData, resetAll)

export function sizeBucket(pr) {
  const n = (pr.additions || 0) + (pr.deletions || 0)
  if (n < 10) return 'XS'
  if (n < 100) return 'S'
  if (n < 500) return 'M'
  if (n < 1000) return 'L'
  return 'XL'
}

function prMergeState(pr) {
  if (pr.mergedAt) return 'merged'
  if (pr.closedAt) return 'closed'
  return 'open'
}

export function prKey(pr) {
  return `${pr.repo}#${pr.number}`
}

function activeCount({ kind, repos, authors, state: mergeState, sizes, bases, key }) {
  let c = 0
  if (state.search) c++
  if (kind && kind !== 'all') c++
  if (repos?.size) c += repos.size
  if (authors?.size) c += authors.size
  if (mergeState && mergeState !== 'any') c++
  if (sizes?.size) c += sizes.size
  if (bases?.size) c += bases.size
  if (key) c++
  return c
}

function applyFilters(prs, opts) {
  const { kind, repos, authors, state: mergeState, sizes, bases, key } = opts

  if (key) {
    const match = prs.find(p => prKey(p) === key)
    return match ? [match] : []
  }

  let result = prs

  if (kind === 'authored') result = result.filter(p => p.kind === 'authored')
  else if (kind === 'reviewed') result = result.filter(p => p.kind === 'review')

  const q = state.search.trim().toLowerCase()
  if (q) {
    result = result.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.repoShort?.toLowerCase().includes(q) ||
      String(p.number).includes(q) ||
      p.jiraIds?.some(id => id.toLowerCase().includes(q))
    )
  }
  if (repos?.size) result = result.filter(p => repos.has(p.repoShort) || repos.has(p.repo))
  if (authors?.size) result = result.filter(p => authors.has(p.author))
  if (mergeState && mergeState !== 'any') result = result.filter(p => prMergeState(p) === mergeState)
  if (sizes?.size) result = result.filter(p => sizes.has(sizeBucket(p)))
  if (bases?.size) result = result.filter(p => bases.has(p.base))

  const sortKey = state.sort
  result = [...result].sort((a, b) => {
    if (sortKey === 'mergedAt') return (b.mergedAt || b.closedAt || b.createdAt || '').localeCompare(a.mergedAt || a.closedAt || a.createdAt || '')
    if (sortKey === 'createdAt') return (b.createdAt || '').localeCompare(a.createdAt || '')
    if (sortKey === 'size') return ((b.additions || 0) + (b.deletions || 0)) - ((a.additions || 0) + (a.deletions || 0))
    if (sortKey === 'correlation') return (b.correlatedSessions?.length || 0) - (a.correlatedSessions?.length || 0)
    return 0
  })
  return result
}

function queryParamAsSet(query, key) {
  const val = query[key]
  if (!val) return new Set()
  return new Set(Array.isArray(val) ? val : [val])
}

function queryParamAsString(query, key, fallback = '') {
  const val = query[key]
  if (!val) return fallback
  return Array.isArray(val) ? val[0] : val
}

export function useUrlPrFacets(route) {
  const activeKind = computed(() => {
    const k = queryParamAsString(route.query, 'kind', 'all')
    return ['all', 'authored', 'reviewed'].includes(k) ? k : 'all'
  })
  const activeRepos = computed(() => queryParamAsSet(route.query, 'repo'))
  const activeAuthors = computed(() => queryParamAsSet(route.query, 'author'))
  const activeState = computed(() => {
    const s = queryParamAsString(route.query, 'state', 'any')
    return ['any', 'merged', 'closed', 'open'].includes(s) ? s : 'any'
  })
  const activeSizes = computed(() => queryParamAsSet(route.query, 'size'))
  const activeBases = computed(() => queryParamAsSet(route.query, 'base'))
  const activeKey = computed(() => queryParamAsString(route.query, 'key', ''))

  const opts = computed(() => ({
    kind: activeKind.value,
    repos: activeRepos.value,
    authors: activeAuthors.value,
    state: activeState.value,
    sizes: activeSizes.value,
    bases: activeBases.value,
    key: activeKey.value,
  }))

  const filteredPrs = (prs) => applyFilters(prs, opts.value)
  const totalActiveCount = computed(() => activeCount(opts.value))

  return {
    activeKind,
    activeRepos,
    activeAuthors,
    activeState,
    activeSizes,
    activeBases,
    activeKey,
    filteredPrs,
    totalActiveCount,
  }
}

export function usePrFilters() {
  return { state, resetAll }
}
