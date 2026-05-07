<script setup>
import { computed, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { usePrFilters, useUrlPrFacets, sizeBucket, prKey } from '../stores/prFilters.js'
import { formatNumber } from '../utils/format.js'
import PrCard from '../components/PrCard.vue'
import EmptyState from '../components/EmptyState.vue'

const REPO_COLLAPSED_LIMIT = 8

const router = useRouter()
const route = useRoute()
const { reportData } = useReportStore()
const { state: filters, resetAll } = usePrFilters()
const {
  activeKind,
  activeRepos,
  activeAuthors,
  activeState,
  activeSizes,
  activeBases,
  activeKey,
  filteredPrs: computeFiltered,
  totalActiveCount,
} = useUrlPrFacets(route)

const repoFacetSearch = ref('')
const repoShowAll = ref(false)

const allPrs = computed(() => [
  ...(reportData.value?.prs || []),
  ...(reportData.value?.reviewedPrs || []),
])

const codeVolume = computed(() => {
  let additions = 0, deletions = 0
  for (const pr of allPrs.value) {
    additions += pr.additions || 0
    deletions += pr.deletions || 0
  }
  return { additions, deletions }
})

const correlationRate = computed(() => {
  const t = reportData.value?.totals
  if (!t || !t.sessions) return 0
  return Math.round(((t.sessions - t.uncorrelatedSessions) / t.sessions) * 100)
})

function replaceFilterQuery(updates) {
  const query = { ...route.query }
  const kind = 'kind' in updates ? updates.kind : activeKind.value
  const repos = updates.repo ?? activeRepos.value
  const authors = updates.author ?? activeAuthors.value
  const stateVal = 'state' in updates ? updates.state : activeState.value
  const sizes = updates.size ?? activeSizes.value
  const bases = updates.base ?? activeBases.value
  const key = 'key' in updates ? updates.key : activeKey.value

  if (kind && kind !== 'all') query.kind = kind
  else delete query.kind
  if (repos.size) query.repo = [...repos]
  else delete query.repo
  if (authors.size) query.author = [...authors]
  else delete query.author
  if (stateVal && stateVal !== 'any') query.state = stateVal
  else delete query.state
  if (sizes.size) query.size = [...sizes]
  else delete query.size
  if (bases.size) query.base = [...bases]
  else delete query.base
  if (key) query.key = key
  else delete query.key

  router.replace({ query })
}

function setKind(k) { replaceFilterQuery({ kind: k }) }
function setState(s) { replaceFilterQuery({ state: s }) }

function makeSetFacet(queryKey, activeRef) {
  return {
    toggle(v) {
      const s = new Set(activeRef.value)
      s.has(v) ? s.delete(v) : s.add(v)
      replaceFilterQuery({ [queryKey]: s })
    },
    clear() { replaceFilterQuery({ [queryKey]: new Set() }) },
  }
}

const { toggle: toggleRepo, clear: clearRepos } = makeSetFacet('repo', activeRepos)
const { toggle: toggleAuthor, clear: clearAuthors } = makeSetFacet('author', activeAuthors)
const { toggle: toggleSize, clear: clearSizes } = makeSetFacet('size', activeSizes)
const { toggle: toggleBase, clear: clearBases } = makeSetFacet('base', activeBases)

function clearKey() { replaceFilterQuery({ key: null }) }

function clearAllFilters() {
  resetAll()
  repoFacetSearch.value = ''
  repoShowAll.value = false
  router.replace({ query: {} })
}

const KIND_OPTS = [['all', 'All'], ['authored', 'Authored'], ['reviewed', 'Reviewed']]
const STATE_OPTS = [['any', 'Any'], ['merged', 'Merged'], ['closed', 'Closed'], ['open', 'Open']]
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL']

const sizeCounts = computed(() => {
  const m = {}
  for (const p of allPrs.value) {
    const b = sizeBucket(p)
    m[b] = (m[b] || 0) + 1
  }
  return m
})

const allAuthors = computed(() => {
  const m = new Map()
  for (const p of allPrs.value) {
    if (!p.author) continue
    m.set(p.author, (m.get(p.author) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})

const authorsVisible = computed(() => {
  if (activeKind.value === 'authored') return false
  return allAuthors.value.length >= 2
})

const allBases = computed(() => {
  const m = new Map()
  for (const p of allPrs.value) {
    if (!p.base) continue
    m.set(p.base, (m.get(p.base) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})

const basesVisible = computed(() => allBases.value.length >= 2)

const allRepos = computed(() => {
  const m = new Map()
  for (const p of allPrs.value) {
    const k = p.repoShort
    if (!k) continue
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
})

const matchingRepos = computed(() => {
  const q = repoFacetSearch.value.trim().toLowerCase()
  return q ? allRepos.value.filter(([r]) => r.toLowerCase().includes(q)) : allRepos.value
})
const unpinnedMatching = computed(() =>
  matchingRepos.value.filter(([r]) => !activeRepos.value.has(r))
)
const visibleRepos = computed(() => {
  const pinned = allRepos.value.filter(([r]) => activeRepos.value.has(r))
  const rest = repoShowAll.value ? unpinnedMatching.value : unpinnedMatching.value.slice(0, REPO_COLLAPSED_LIMIT)
  return [...pinned, ...rest]
})
const repoOverflow = computed(() => Math.max(0, unpinnedMatching.value.length - REPO_COLLAPSED_LIMIT))

const filteredPrs = computed(() => computeFiltered(allPrs.value))
</script>

<template>
  <div class="px-8 py-6">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-on-surface font-headline mb-1">Pull Request Tracker</h1>
      <p class="text-sm text-on-surface-variant">Authored and reviewed contributions with session correlation</p>
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

        <div v-if="activeKey" class="facet-group">
          <div class="facet-hdr">
            <span>PR</span>
            <button class="reset" @click="clearKey">Clear</button>
          </div>
          <div class="flex items-center gap-2 px-2 py-1.5 rounded bg-primary/15 text-primary text-xs font-mono">
            <span class="material-symbols-outlined text-sm">merge</span>
            <span class="truncate" :title="activeKey">{{ activeKey }}</span>
          </div>
        </div>

        <div class="facet-group">
          <div class="facet-hdr"><span>Kind</span></div>
          <div class="facet-segmented">
            <button
              v-for="[v, l] in KIND_OPTS"
              :key="v"
              :class="{ on: activeKind === v }"
              @click="setKind(v)"
            >{{ l }}</button>
          </div>
        </div>

        <div class="facet-group">
          <div class="facet-hdr"><span>Merge state</span></div>
          <div class="facet-segmented">
            <button
              v-for="[v, l] in STATE_OPTS"
              :key="v"
              :class="{ on: activeState === v }"
              @click="setState(v)"
            >{{ l }}</button>
          </div>
        </div>

        <div class="facet-group">
          <div class="facet-hdr">
            <span>Size</span>
            <button v-if="activeSizes.size > 0" class="reset" @click="clearSizes">Reset</button>
          </div>
          <div class="flex flex-col gap-px">
            <button
              v-for="sz in SIZE_ORDER"
              :key="sz"
              class="facet-item"
              :class="{ on: activeSizes.has(sz) }"
              @click="toggleSize(sz)"
            >
              <span class="chk"></span>
              <span>{{ sz }}</span>
              <span class="facet-cnt">{{ sizeCounts[sz] || 0 }}</span>
            </button>
          </div>
        </div>

        <div v-if="basesVisible" class="facet-group">
          <div class="facet-hdr">
            <span>Target branch</span>
            <button v-if="activeBases.size > 0" class="reset" @click="clearBases">Reset</button>
          </div>
          <div class="flex flex-col gap-px">
            <button
              v-for="[b, n] in allBases"
              :key="b"
              class="facet-item"
              :class="{ on: activeBases.has(b) }"
              :title="b"
              @click="toggleBase(b)"
            >
              <span class="chk"></span>
              <span class="flex-1 truncate text-left">{{ b }}</span>
              <span class="facet-cnt">{{ n }}</span>
            </button>
          </div>
        </div>

        <div v-if="authorsVisible" class="facet-group">
          <div class="facet-hdr">
            <span>Author</span>
            <button v-if="activeAuthors.size > 0" class="reset" @click="clearAuthors">Reset</button>
          </div>
          <div class="flex flex-col gap-px max-h-60 overflow-y-auto">
            <button
              v-for="[a, n] in allAuthors"
              :key="a"
              class="facet-item"
              :class="{ on: activeAuthors.has(a) }"
              :title="a"
              @click="toggleAuthor(a)"
            >
              <span class="chk"></span>
              <span class="flex-1 truncate text-left">{{ a }}</span>
              <span class="facet-cnt">{{ n }}</span>
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
      </aside>

      <div class="min-w-0">
        <div class="grid grid-cols-12 gap-4 mb-8">
          <div class="col-span-5 bg-surface-container-high rounded-xl p-5">
            <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-4">Authored vs Reviewed</p>
            <div class="flex items-end gap-6">
              <div>
                <p class="text-3xl font-mono font-bold text-secondary">{{ reportData.totals.prs }}</p>
                <p class="text-xs text-on-surface-variant">Authored</p>
              </div>
              <div class="flex-1">
                <div class="flex h-3 rounded-full overflow-hidden bg-surface-container-lowest">
                  <div
                    class="bg-secondary transition-all"
                    :style="{ width: `${(reportData.totals.prs / ((reportData.totals.prs + reportData.totals.reviewedPrs) || 1)) * 100}%` }"
                  />
                  <div class="bg-primary flex-1" />
                </div>
              </div>
              <div class="text-right">
                <p class="text-3xl font-mono font-bold text-primary">{{ reportData.totals.reviewedPrs }}</p>
                <p class="text-xs text-on-surface-variant">Reviewed</p>
              </div>
            </div>
          </div>

          <div class="col-span-4 bg-surface-container-high rounded-xl p-5">
            <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-4">Code Volume</p>
            <div class="flex items-baseline gap-4">
              <div>
                <span class="text-2xl font-mono font-bold text-secondary">+{{ formatNumber(codeVolume.additions) }}</span>
                <span class="text-xs text-on-surface-variant ml-1">additions</span>
              </div>
              <div>
                <span class="text-2xl font-mono font-bold text-error">-{{ formatNumber(codeVolume.deletions) }}</span>
                <span class="text-xs text-on-surface-variant ml-1">deletions</span>
              </div>
            </div>
          </div>

          <div class="col-span-3 bg-surface-container-high rounded-xl p-5">
            <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-4">Correlation Rate</p>
            <p class="text-3xl font-mono font-bold text-on-surface">{{ correlationRate }}<span class="text-lg">%</span></p>
            <p class="text-xs text-on-surface-variant mt-1">sessions linked to PRs</p>
          </div>
        </div>

        <div class="flex items-center gap-3 mb-4">
          <div class="relative flex-1">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg pointer-events-none">search</span>
            <input
              v-model="filters.search"
              type="text"
              placeholder="Search title, repo, number, Jira ID…"
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
            <option value="mergedAt">Most Recent</option>
            <option value="createdAt">Newest Created</option>
            <option value="size">Largest First</option>
            <option value="correlation">Most Correlated</option>
          </select>
          <span class="font-mono text-[0.6875rem] text-on-surface-variant whitespace-nowrap">
            {{ filteredPrs.length }} / {{ allPrs.length }}
          </span>
        </div>

        <div class="space-y-3">
          <PrCard v-for="pr in filteredPrs" :key="prKey(pr)" :pr="pr" />
        </div>

        <EmptyState v-if="!filteredPrs.length" icon="merge" message="No pull requests match your filters" />
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
</style>
