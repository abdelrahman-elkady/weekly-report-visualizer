<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { formatDuration, isHighIdleRatio, truncateId, truncateText, formatNumber, formatUtcDateShort, formatUtcWeekdayShort, utcDateKey } from '../utils/format.js'
import { getCategoryInfo, getAllCategories } from '../utils/categories.js'
import EmptyState from '../components/EmptyState.vue'

const router = useRouter()
const route = useRoute()
const { reportData } = useReportStore()

const searchQuery = ref('')
const repoDropdownOpen = ref(false)
const repoSearch = ref('')
const sortBy = ref('createdAt')
const page = ref(1)
const perPage = 25

const totals = computed(() => reportData.value?.totals)
const sessions = computed(() => reportData.value?.sessions || [])

function queryParamAsSet(key) {
  const val = route.query[key]
  if (!val) return new Set()
  return new Set(Array.isArray(val) ? val : [val])
}

const activeCategories = computed(() => queryParamAsSet('category'))
const activeRepos = computed(() => {
  const raw = queryParamAsSet('repo')
  return new Set([...raw].map(r => r.includes('/') ? r.split('/').pop() : r))
})
const activeDate = computed(() => {
  const val = route.query.date
  return Array.isArray(val) ? val[0] : (val || '')
})

const allRepos = computed(() => {
  const repos = new Set()
  for (const s of sessions.value) {
    if (s.repoShort) repos.add(s.repoShort)
  }
  return [...repos].sort()
})

const filteredRepoOptions = computed(() => {
  if (!repoSearch.value) return allRepos.value
  const q = repoSearch.value.toLowerCase()
  return allRepos.value.filter(r => r.toLowerCase().includes(q))
})

function replaceFilterQuery(updates) {
  const query = {}
  const cats = updates.category ?? activeCategories.value
  const repos = updates.repo ?? activeRepos.value
  const date = 'date' in updates ? updates.date : activeDate.value
  if (cats.size) query.category = [...cats]
  if (repos.size) query.repo = [...repos]
  if (date) query.date = date
  router.replace({ query })
  page.value = 1
}

function toggleRepo(repo) {
  const s = new Set(activeRepos.value)
  if (s.has(repo)) s.delete(repo)
  else s.add(repo)
  replaceFilterQuery({ repo: s })
}

function clearRepoFilter() {
  repoSearch.value = ''
  replaceFilterQuery({ repo: new Set() })
}

function toggleCategory(cat) {
  const s = new Set(activeCategories.value)
  if (s.has(cat)) s.delete(cat)
  else s.add(cat)
  replaceFilterQuery({ category: s })
}

function clearDateFilter() {
  replaceFilterQuery({ date: null })
}

const correlatedCount = computed(() =>
  totals.value ? totals.value.sessions - totals.value.uncorrelatedSessions : 0
)

const filteredSessions = computed(() => {
  let result = sessions.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(s =>
      s.firstPromptShort?.toLowerCase().includes(q) ||
      s.gitBranch?.toLowerCase().includes(q) ||
      s.sessionId?.toLowerCase().includes(q)
    )
  }

  if (activeRepos.value.size > 0) {
    result = result.filter(s =>
      activeRepos.value.has(s.repoShort) || activeRepos.value.has(s.repo)
    )
  }

  if (activeCategories.value.size > 0) {
    result = result.filter(s => activeCategories.value.has(s.category))
  }

  if (activeDate.value) {
    result = result.filter(s => utcDateKey(s.createdAt) === activeDate.value)
  }

  const key = sortBy.value
  result = [...result].sort((a, b) => {
    if (key === 'durationMin') return ((b.activeDurationMin ?? b.durationMin) || 0) - ((a.activeDurationMin ?? a.durationMin) || 0)
    if (key === 'createdAt') return (b.createdAt || '').localeCompare(a.createdAt || '')
    if (key === 'correlation') return (b.correlatedPRs?.length || 0) - (a.correlatedPRs?.length || 0)
    return 0
  })

  return result
})

const totalPages = computed(() => Math.ceil(filteredSessions.value.length / perPage) || 1)

const paginatedSessions = computed(() => {
  const start = (page.value - 1) * perPage
  return filteredSessions.value.slice(start, start + perPage)
})

function goToSession(id) {
  router.push(`/sessions/${id}`)
}

const sortOptions = [
  { value: 'createdAt', label: 'Most Recent' },
  { value: 'durationMin', label: 'Longest First' },
  { value: 'correlation', label: 'Most Correlated' },
]
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="flex items-start justify-between mb-6">
      <div>
        <h1 class="text-3xl font-bold text-on-surface font-headline mb-1">Sessions Explorer</h1>
        <p class="text-sm text-on-surface-variant">Browse and filter all agent sessions</p>
      </div>
      <div class="flex gap-6 text-right">
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

    <!-- Filters -->
    <div class="space-y-3 mb-6">
      <!-- Row 1: Search, Repo dropdown, Sort -->
      <div class="flex items-center gap-3">
        <div class="relative flex-1 max-w-xs">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
          <input
            v-model="searchQuery"
            @input="page = 1"
            type="text"
            placeholder="Search by branch, prompt, ID..."
            class="w-full bg-surface-container-lowest text-on-surface text-sm pl-10 pr-4 py-2 rounded-lg outline-none placeholder:text-outline focus:ring-1 focus:ring-primary/40"
          />
        </div>

        <!-- Repo multi-select dropdown -->
        <div class="relative">
          <button
            @click="repoDropdownOpen = !repoDropdownOpen"
            class="flex items-center gap-2 bg-surface-container-lowest text-sm px-3 py-2 rounded-lg transition-colors"
            :class="activeRepos.size ? 'text-primary ring-1 ring-primary/40' : 'text-on-surface-variant'"
          >
            <span class="material-symbols-outlined text-base">folder</span>
            <span class="font-mono text-xs">
              {{ activeRepos.size ? `${activeRepos.size} repo${activeRepos.size > 1 ? 's' : ''}` : 'All repos' }}
            </span>
            <span class="material-symbols-outlined text-base transition-transform" :class="repoDropdownOpen ? 'rotate-180' : ''">expand_more</span>
          </button>
          <div
            v-if="repoDropdownOpen"
            class="absolute z-20 top-full mt-1 left-0 w-56 bg-surface-container-highest rounded-lg shadow-lg border border-outline-variant/20 overflow-hidden"
          >
            <div class="p-2 border-b border-outline-variant/15">
              <input
                v-model="repoSearch"
                type="text"
                placeholder="Filter repos..."
                class="w-full bg-surface-container-lowest text-on-surface text-xs px-2.5 py-1.5 rounded outline-none placeholder:text-outline"
              />
            </div>
            <div class="max-h-48 overflow-y-auto py-1">
              <button
                v-for="repo in filteredRepoOptions"
                :key="repo"
                @click="toggleRepo(repo)"
                class="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-mono text-left hover:bg-surface-container-high transition-colors"
                :class="activeRepos.has(repo) ? 'text-primary' : 'text-on-surface-variant'"
              >
                <span class="material-symbols-outlined text-sm">{{ activeRepos.has(repo) ? 'check_box' : 'check_box_outline_blank' }}</span>
                {{ repo }}
              </button>
            </div>
            <div v-if="activeRepos.size" class="p-2 border-t border-outline-variant/15">
              <button @click="clearRepoFilter" class="text-[0.625rem] font-mono text-on-surface-variant hover:text-on-surface transition-colors">
                Clear selection
              </button>
            </div>
          </div>
          <!-- Backdrop to close dropdown -->
          <div v-if="repoDropdownOpen" class="fixed inset-0 z-10" @click="repoDropdownOpen = false; repoSearch = ''" />
        </div>

        <select
          v-model="sortBy"
          class="bg-surface-container-lowest text-on-surface text-xs font-mono px-3 py-2 rounded-lg outline-none cursor-pointer"
        >
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>

        <button
          v-if="activeDate"
          @click="clearDateFilter"
          class="flex items-center gap-2 text-xs font-mono px-3 py-2 rounded-lg bg-primary/20 text-primary"
        >
          <span class="material-symbols-outlined text-base">event</span>
          {{ formatUtcWeekdayShort(activeDate) }} {{ formatUtcDateShort(activeDate) }}
          <span class="material-symbols-outlined text-sm">close</span>
        </button>
      </div>

      <!-- Row 2: Category toggles -->
      <div class="flex gap-1.5 flex-wrap">
        <button
          v-for="cat in getAllCategories()"
          :key="cat"
          @click="toggleCategory(cat)"
          class="text-[0.625rem] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors"
          :class="activeCategories.has(cat)
            ? 'bg-primary/20 text-primary'
            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'"
        >
          {{ getCategoryInfo(cat).label }}
        </button>
      </div>
    </div>

    <!-- Table header -->
    <div class="grid grid-cols-12 gap-3 px-4 py-2 text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-1">
      <div class="col-span-1">Session</div>
      <div class="col-span-2">Repo</div>
      <div class="col-span-1">Category</div>
      <div class="col-span-2">Branch</div>
      <div class="col-span-1 text-right">Duration</div>
      <div class="col-span-4">First Prompt</div>
      <div class="col-span-1 text-center">PRs</div>
    </div>

    <!-- Rows -->
    <div
      v-for="session in paginatedSessions"
      :key="session.sessionId"
      @click="goToSession(session.sessionId)"
      class="grid grid-cols-12 gap-3 px-4 py-3 hover:bg-surface-container-high/60 transition-colors cursor-pointer items-center rounded-lg"
      :class="{ 'opacity-50': session.category === 'discarded' }"
    >
      <div class="col-span-1 text-xs font-mono text-primary">{{ truncateId(session.sessionId) }}</div>
      <div class="col-span-2">
        <span class="text-xs px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono">
          {{ session.repoShort }}
        </span>
      </div>
      <div class="col-span-1 flex items-center gap-1">
        <span class="material-symbols-outlined text-sm" :class="`text-${getCategoryInfo(session.category).color}`">
          {{ getCategoryInfo(session.category).icon }}
        </span>
        <span class="text-xs text-on-surface-variant hidden xl:inline">{{ getCategoryInfo(session.category).label }}</span>
      </div>
      <div class="col-span-2 text-xs font-mono text-on-surface-variant truncate">{{ session.gitBranch }}</div>
      <div class="col-span-1 text-right">
        <span class="text-xs font-mono" :class="isHighIdleRatio(session.durationMin, session.activeDurationMin) ? 'text-tertiary' : 'text-on-surface'">
          {{ formatDuration(session.activeDurationMin ?? session.durationMin) }}
        </span>
        <span v-if="isHighIdleRatio(session.durationMin, session.activeDurationMin)" class="material-symbols-outlined text-xs text-tertiary ml-0.5" title="High idle ratio">warning</span>
      </div>
      <div class="col-span-4 text-xs text-on-surface-variant truncate">{{ truncateText(session.firstPromptShort, 60) }}</div>
      <div class="col-span-1 text-center">
        <span v-if="session.correlatedPRs?.length" class="text-xs font-mono text-secondary">{{ session.correlatedPRs.length }}</span>
        <span v-else class="text-xs text-on-surface-variant">—</span>
      </div>
    </div>

    <EmptyState v-if="!paginatedSessions.length" icon="search_off" message="No sessions match your filters" />

    <!-- Pagination -->
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
</template>
