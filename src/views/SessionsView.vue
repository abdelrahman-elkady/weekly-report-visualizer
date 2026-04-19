<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { useSessionFilters, useUrlFacets } from '../stores/sessionFilters.js'
import { formatDuration, isHighIdleRatio, truncateId, truncateText, formatNumber, formatUtcDateShort, formatUtcWeekdayShort } from '../utils/format.js'
import { getCategoryInfo, getAllCategories } from '../utils/categories.js'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const route = useRoute()
const { reportData } = useReportStore()
const { state: filters, resetAll, activeCount } = useSessionFilters()
const { activeCategories, activeRepos, activeDate, filteredSessions: computeFiltered } = useUrlFacets(route)

const page = ref(1)
const perPage = 25
const repoFacetSearch = ref('')
const repoShowAll = ref(false)

const totals = computed(() => reportData.value?.totals)
const sessions = computed(() => reportData.value?.sessions || [])

const correlatedCount = computed(() =>
  totals.value ? totals.value.sessions - totals.value.uncorrelatedSessions : 0
)

function replaceFilterQuery(updates) {
  const query = { ...route.query }
  const cats = updates.category ?? activeCategories.value
  const repos = updates.repo ?? activeRepos.value
  const date = 'date' in updates ? updates.date : activeDate.value

  if (cats.size) query.category = [...cats]
  else delete query.category
  if (repos.size) query.repo = [...repos]
  else delete query.repo
  if (date) query.date = date
  else delete query.date

  router.replace({ query })
}

function toggleRepo(repo) {
  const s = new Set(activeRepos.value)
  s.has(repo) ? s.delete(repo) : s.add(repo)
  replaceFilterQuery({ repo: s })
}
function clearRepos() { replaceFilterQuery({ repo: new Set() }) }

function toggleCategory(cat) {
  const s = new Set(activeCategories.value)
  s.has(cat) ? s.delete(cat) : s.add(cat)
  replaceFilterQuery({ category: s })
}
function clearCategories() { replaceFilterQuery({ category: new Set() }) }

function clearDate() { replaceFilterQuery({ date: null }) }

function clearAllFilters() {
  resetAll()
  repoFacetSearch.value = ''
  repoShowAll.value = false
  router.replace({ query: {} })
}

const allCategories = getAllCategories()

const categoryCounts = computed(() => {
  const m = {}
  for (const s of sessions.value) m[s.category] = (m[s.category] || 0) + 1
  return m
})

const allRepos = computed(() => {
  const m = new Map()
  for (const s of sessions.value) {
    const key = s.repoShort
    if (!key) continue
    m.set(key, (m.get(key) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})

const matchingRepos = computed(() => {
  const q = repoFacetSearch.value.trim().toLowerCase()
  return q ? allRepos.value.filter(([r]) => r.toLowerCase().includes(q)) : allRepos.value
})
const visibleRepos = computed(() =>
  repoShowAll.value ? matchingRepos.value : matchingRepos.value.slice(0, 8)
)
const repoOverflow = computed(() => Math.max(0, matchingRepos.value.length - 8))

const topTools = computed(() => {
  const m = {}
  for (const s of sessions.value) {
    for (const t of Object.keys(s.toolCounts || {})) m[t] = (m[t] || 0) + 1
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8)
})

function toggleTool(t) {
  const i = filters.tools.indexOf(t)
  if (i >= 0) filters.tools.splice(i, 1)
  else filters.tools.push(t)
}

function setDuration(kind, value) {
  const v = Number(value)
  if (kind === 'min') filters.minDuration = Math.min(v, filters.maxDuration)
  else filters.maxDuration = Math.max(v, filters.minDuration)
}

function resetDuration() {
  filters.minDuration = 0
  filters.maxDuration = 300
}

const filteredSessions = computed(() => computeFiltered(sessions.value))

const totalActiveCount = computed(() =>
  activeCount(activeCategories.value.size, activeRepos.value.size, !!activeDate.value)
)

const totalPages = computed(() => Math.ceil(filteredSessions.value.length / perPage) || 1)
const paginatedSessions = computed(() => {
  const start = (page.value - 1) * perPage
  return filteredSessions.value.slice(start, start + perPage)
})

watch(filteredSessions, () => { page.value = 1 })

function goToSession(id) {
  router.push({ name: 'session-detail', params: { id }, query: route.query })
}

const ANY_OPTS = [['any', 'Any'], ['yes', 'Yes'], ['no', 'No']]
const DATE_RANGE_OPTS = [['any', 'All'], ['today', '24h'], ['7d', '7d'], ['30d', '30d']]

const segmentedFacets = [
  { key: 'dateRange', label: 'Date range', options: DATE_RANGE_OPTS },
  { key: 'hasPR', label: 'Correlated PR', options: ANY_OPTS },
  { key: 'hasJira', label: 'Jira ticket', options: ANY_OPTS },
  { key: 'highIdle', label: 'High idle ratio', options: ANY_OPTS },
]

const sortHeaders = [
  { key: 'durationMin', label: 'Duration', align: 'right' },
  { key: 'createdAt', label: 'First Prompt', align: 'left' },
  { key: 'correlation', label: 'PRs', align: 'center' },
]
</script>

<template>
  <div class="px-8 py-6">
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-on-surface font-headline mb-1">Sessions Explorer</h1>
        <p class="text-sm text-on-surface-variant">Browse and filter all agent sessions</p>
      </div>
      <div class="flex gap-7 text-right">
        <div>
          <p class="text-2xl font-mono font-bold text-on-surface">{{ formatNumber(totals?.sessions) }}</p>
          <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Total</p>
        </div>
        <div>
          <p class="text-2xl font-mono font-bold text-secondary">{{ formatNumber(correlatedCount) }}</p>
          <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Correlated</p>
        </div>
        <div>
          <p class="text-2xl font-mono font-bold text-tertiary">{{ formatNumber(totals?.uncorrelatedSessions) }}</p>
          <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Uncorrelated</p>
        </div>
      </div>
    </div>

    <div class="grid gap-6 items-start facet-layout">
      <aside class="facet-col flex flex-col gap-5">
        <div class="flex items-center justify-between">
          <span class="text-[0.625rem] font-mono uppercase tracking-wider text-on-surface-variant">
            Filters
            <span v-if="totalActiveCount > 0" class="text-primary">· {{ totalActiveCount }}</span>
          </span>
          <button
            v-if="totalActiveCount > 0"
            @click="clearAllFilters"
            class="text-[0.625rem] font-mono uppercase tracking-wider text-on-surface-variant hover:text-error transition-colors"
          >
            Clear all
          </button>
        </div>

        <!-- Specific date chip (set via chart click-through on Summary) -->
        <div v-if="activeDate" class="facet-group">
          <div class="facet-hdr">
            <span>Day</span>
            <button class="reset" @click="clearDate">Clear</button>
          </div>
          <div class="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/15 text-primary text-xs font-mono">
            <span class="material-symbols-outlined text-sm">event</span>
            {{ formatUtcWeekdayShort(activeDate) }} {{ formatUtcDateShort(activeDate) }}
          </div>
        </div>

        <div v-for="facet in segmentedFacets" :key="facet.key" class="facet-group">
          <div class="facet-hdr"><span>{{ facet.label }}</span></div>
          <div class="facet-segmented">
            <button
              v-for="[v, l] in facet.options"
              :key="v"
              :class="{ on: filters[facet.key] === v }"
              @click="filters[facet.key] = v"
            >{{ l }}</button>
          </div>
        </div>

        <div class="facet-group">
          <div class="facet-hdr">
            <span>Duration</span>
            <button
              v-if="filters.minDuration > 0 || filters.maxDuration < 300"
              class="reset"
              @click="resetDuration"
            >Reset</button>
          </div>
          <div class="range-row">
            <span>Min <span class="v">{{ filters.minDuration }}m</span></span>
            <span>Max <span class="v">{{ filters.maxDuration === 300 ? '5h+' : filters.maxDuration + 'm' }}</span></span>
          </div>
          <input type="range" min="0" max="300" step="5" :value="filters.minDuration" @input="setDuration('min', $event.target.value)" />
          <input type="range" min="0" max="300" step="5" :value="filters.maxDuration" @input="setDuration('max', $event.target.value)" />
        </div>

        <div class="facet-group">
          <div class="facet-hdr">
            <span>Category</span>
            <button v-if="activeCategories.size > 0" class="reset" @click="clearCategories">Reset</button>
          </div>
          <div class="flex flex-col gap-px">
            <button
              v-for="cat in allCategories"
              :key="cat"
              class="facet-item"
              :class="{ on: activeCategories.has(cat) }"
              @click="toggleCategory(cat)"
            >
              <span class="chk"></span>
              <span class="material-symbols-outlined cat-ico" :class="`text-${getCategoryInfo(cat).color}`">
                {{ getCategoryInfo(cat).icon }}
              </span>
              <span>{{ getCategoryInfo(cat).label }}</span>
              <span class="facet-cnt">{{ categoryCounts[cat] || 0 }}</span>
            </button>
          </div>
        </div>

        <div class="facet-group">
          <div class="facet-hdr">
            <span>Repo</span>
            <button v-if="activeRepos.size > 0" class="reset" @click="clearRepos">Reset</button>
          </div>
          <div class="relative">
            <span class="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none">search</span>
            <input
              v-model="repoFacetSearch"
              type="text"
              placeholder="Filter repos…"
              class="w-full bg-surface-container-lowest text-on-surface text-xs pl-7 pr-2.5 py-1.5 rounded outline-none placeholder:text-outline focus:ring-1 focus:ring-primary/40"
            />
          </div>
          <div class="flex flex-col gap-px max-h-60 overflow-y-auto">
            <button
              v-for="[r, n] in visibleRepos"
              :key="r"
              class="facet-item"
              :class="{ on: activeRepos.has(r) }"
              :title="r"
              @click="toggleRepo(r)"
            >
              <span class="chk"></span>
              <span class="flex-1 truncate text-left">{{ r }}</span>
              <span class="facet-cnt">{{ n }}</span>
            </button>
            <button
              v-if="!repoShowAll && repoOverflow > 0"
              class="facet-item justify-center text-primary"
              @click="repoShowAll = true"
            >+ {{ repoOverflow }} more</button>
          </div>
        </div>

        <div v-if="topTools.length > 0" class="facet-group">
          <div class="facet-hdr">
            <span>Uses tool</span>
            <button v-if="filters.tools.length > 0" class="reset" @click="filters.tools = []">Reset</button>
          </div>
          <div class="flex flex-col gap-px">
            <button
              v-for="[t, n] in topTools"
              :key="t"
              class="facet-item"
              :class="{ on: filters.tools.includes(t) }"
              @click="toggleTool(t)"
            >
              <span class="chk"></span>
              <span>{{ t }}</span>
              <span class="facet-cnt">{{ n }}</span>
            </button>
          </div>
        </div>
      </aside>

      <div class="min-w-0">
        <div class="flex items-center gap-3 mb-4">
          <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">search</span>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search branch, prompt, ID, repo…"
              class="w-full bg-surface-container-lowest text-on-surface text-sm pl-10 pr-9 py-2 rounded-lg outline-none placeholder:text-outline focus:ring-1 focus:ring-primary/40"
            />
            <button
              v-if="filters.search"
              @click="filters.search = ''"
              class="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
            >
              <span class="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <select
            v-model="filters.sort"
            class="bg-surface-container-lowest text-on-surface text-xs font-mono px-3 py-2 rounded-lg outline-none cursor-pointer"
          >
            <option value="createdAt">Most Recent</option>
            <option value="durationMin">Longest First</option>
            <option value="correlation">Most Correlated</option>
          </select>
          <span class="font-mono text-[0.6875rem] text-on-surface-variant whitespace-nowrap">
            {{ filteredSessions.length }} / {{ sessions.length }}
          </span>
        </div>

        <div class="grid grid-cols-12 gap-3 px-4 py-2 text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant border-b border-outline-variant/15">
          <div class="col-span-1">Session</div>
          <div class="col-span-2">Repo</div>
          <div class="col-span-1">Category</div>
          <div class="col-span-2">Branch</div>
          <div class="col-span-1 text-right">
            <button
              class="inline-flex items-center gap-0.5 hover:text-on-surface transition-colors"
              :class="{ 'text-primary': filters.sort === 'durationMin' }"
              @click="filters.sort = 'durationMin'"
            >
              Duration
              <span v-if="filters.sort === 'durationMin'" class="material-symbols-outlined text-xs">arrow_downward</span>
            </button>
          </div>
          <div class="col-span-4">
            <button
              class="inline-flex items-center gap-0.5 hover:text-on-surface transition-colors"
              :class="{ 'text-primary': filters.sort === 'createdAt' }"
              @click="filters.sort = 'createdAt'"
            >
              First Prompt
              <span v-if="filters.sort === 'createdAt'" class="material-symbols-outlined text-xs">arrow_downward</span>
            </button>
          </div>
          <div class="col-span-1 text-center">
            <button
              class="inline-flex items-center gap-0.5 hover:text-on-surface transition-colors"
              :class="{ 'text-primary': filters.sort === 'correlation' }"
              @click="filters.sort = 'correlation'"
            >
              PRs
              <span v-if="filters.sort === 'correlation'" class="material-symbols-outlined text-xs">arrow_downward</span>
            </button>
          </div>
        </div>

        <div
          v-for="session in paginatedSessions"
          :key="session.sessionId"
          @click="goToSession(session.sessionId)"
          class="grid grid-cols-12 gap-3 px-4 py-3 hover:bg-surface-container-high/60 transition-colors cursor-pointer items-center rounded-lg"
          :class="{ 'opacity-50': session.category === 'discarded' }"
        >
          <div class="col-span-1 text-xs font-mono text-primary truncate">{{ truncateId(session.sessionId) }}</div>
          <div class="col-span-2 min-w-0">
            <span class="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono inline-block max-w-full truncate align-middle" :title="session.repo">
              {{ session.repoShort }}
            </span>
          </div>
          <div class="col-span-1 flex items-center gap-1 min-w-0">
            <span class="material-symbols-outlined text-sm" :class="`text-${getCategoryInfo(session.category).color}`">
              {{ getCategoryInfo(session.category).icon }}
            </span>
            <span class="text-xs text-on-surface-variant hidden xl:inline truncate">{{ getCategoryInfo(session.category).label }}</span>
          </div>
          <div class="col-span-2 text-xs font-mono text-on-surface-variant truncate" :title="session.gitBranch">
            {{ session.gitBranch }}
          </div>
          <div class="col-span-1 text-right">
            <span class="text-xs font-mono" :class="isHighIdleRatio(session.durationMin, session.activeDurationMin) ? 'text-tertiary' : 'text-on-surface'">
              {{ formatDuration(session.activeDurationMin ?? session.durationMin) }}
            </span>
            <span v-if="isHighIdleRatio(session.durationMin, session.activeDurationMin)" class="material-symbols-outlined text-xs text-tertiary ml-0.5" title="High idle ratio">warning</span>
          </div>
          <div class="col-span-4 text-xs text-on-surface-variant truncate">{{ truncateText(session.firstPromptShort, 80) }}</div>
          <div class="col-span-1 text-center">
            <span v-if="session.correlatedPRs?.length" class="text-xs font-mono text-secondary">{{ session.correlatedPRs.length }}</span>
            <span v-else class="text-xs text-on-surface-variant opacity-40">—</span>
          </div>
        </div>

        <EmptyState v-if="!paginatedSessions.length" icon="search_off" message="No sessions match your filters" />

        <div v-if="totalPages > 1" class="flex items-center justify-between mt-6 pt-4">
          <span class="text-xs font-mono text-on-surface-variant">
            {{ filteredSessions.length }} sessions
          </span>
          <div class="flex items-center gap-4">
            <button
              @click="page = Math.max(1, page - 1)"
              :disabled="page === 1"
              class="text-xs font-mono text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            >
              <span class="material-symbols-outlined text-base">chevron_left</span>
            </button>
            <span class="text-xs font-mono text-on-surface-variant">{{ page }} / {{ totalPages }}</span>
            <button
              @click="page = Math.min(totalPages, page + 1)"
              :disabled="page === totalPages"
              class="text-xs font-mono text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
            >
              <span class="material-symbols-outlined text-base">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facet-layout {
  grid-template-columns: 240px minmax(0, 1fr);
}

@media (max-width: 900px) {
  .facet-layout {
    grid-template-columns: 1fr;
  }
}

.facet-col {
  position: sticky;
  top: 16px;
}

.facet-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.facet-hdr {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-on-surface-variant);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.facet-hdr .reset {
  background: transparent;
  border: none;
  color: var(--color-on-surface-variant);
  font-family: inherit;
  font-size: 9px;
  cursor: pointer;
  padding: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.facet-hdr .reset:hover { color: var(--color-error); }

.facet-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 0.375rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-on-surface-variant);
  font-family: var(--font-mono);
  font-size: 12px;
  width: 100%;
  text-align: left;
  transition: background 120ms, color 120ms;
}
.facet-item:hover {
  background: var(--color-surface-container);
  color: var(--color-on-surface);
}
.facet-item.on { color: var(--color-primary); }

.facet-item .chk {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid var(--color-outline-variant);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.facet-item.on .chk {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.facet-item.on .chk::before {
  content: '';
  width: 6px;
  height: 6px;
  background: var(--color-on-primary);
  border-radius: 1px;
}

.facet-item .cat-ico { font-size: 14px !important; }
.facet-item .facet-cnt {
  margin-left: auto;
  color: var(--color-on-surface-variant);
  font-size: 10px;
}

.facet-segmented {
  display: flex;
  background: var(--color-surface-container-lowest);
  border-radius: 0.375rem;
  padding: 2px;
  gap: 2px;
}
.facet-segmented button {
  flex: 1;
  background: transparent;
  border: none;
  padding: 6px 8px;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-on-surface-variant);
  cursor: pointer;
  border-radius: 3px;
  transition: background 150ms, color 150ms;
}
.facet-segmented button.on {
  background: var(--color-surface-container-high);
  color: var(--color-primary);
}

.range-row {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-on-surface-variant);
}
.range-row .v { color: var(--color-on-surface); }

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--color-surface-container-lowest);
  border-radius: 2px;
  outline: none;
  margin: 6px 0;
}
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
}
input[type="range"]::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--color-primary);
  border-radius: 50%;
  cursor: pointer;
  border: none;
}
</style>
