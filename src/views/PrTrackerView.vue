<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { formatNumber } from '../utils/format.js'
import PrCard from '../components/PrCard.vue'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const { reportData } = useReportStore()

const filterMode = ref('all') // all | authored | reviewed
const searchQuery = ref('')

watch(() => route.query, (q) => {
  if (q.tab === 'authored' || q.tab === 'reviewed') {
    filterMode.value = q.tab
  } else if (q.tab === undefined) {
    filterMode.value = 'all'
  }
  searchQuery.value = q.search || ''
}, { immediate: true })

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

const filteredPrs = computed(() => {
  let result = allPrs.value

  if (filterMode.value === 'authored') result = result.filter(p => p.kind === 'authored')
  else if (filterMode.value === 'reviewed') result = result.filter(p => p.kind === 'review')

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(p =>
      p.title?.toLowerCase().includes(q) ||
      p.repoShort?.toLowerCase().includes(q) ||
      String(p.number).includes(q) ||
      p.jiraIds?.some(id => id.toLowerCase().includes(q))
    )
  }

  return result
})
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-on-surface font-headline mb-1">Pull Request Tracker</h1>
      <p class="text-sm text-on-surface-variant">Authored and reviewed contributions with session correlation</p>
    </div>

    <!-- Header metrics -->
    <div class="grid grid-cols-12 gap-4 mb-8">
      <!-- Authored vs Reviewed -->
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

      <!-- Code Volume -->
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

      <!-- Correlation Rate -->
      <div class="col-span-3 bg-surface-container-high rounded-xl p-5">
        <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-4">Correlation Rate</p>
        <p class="text-3xl font-mono font-bold text-on-surface">{{ correlationRate }}<span class="text-lg">%</span></p>
        <p class="text-xs text-on-surface-variant mt-1">sessions linked to PRs</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4 mb-6">
      <div class="flex bg-surface-container-low rounded-lg p-0.5">
        <button
          v-for="mode in ['all', 'authored', 'reviewed']"
          :key="mode"
          @click="filterMode = mode"
          class="text-xs font-mono px-4 py-1.5 rounded-md transition-colors capitalize"
          :class="filterMode === mode
            ? 'bg-surface-container-high text-on-surface'
            : 'text-on-surface-variant hover:text-on-surface'"
        >
          {{ mode }}
        </button>
      </div>
      <div class="relative flex-1 max-w-sm">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search PRs..."
          class="w-full bg-surface-container-lowest text-on-surface text-sm pl-10 pr-4 py-2 rounded-lg outline-none placeholder:text-outline focus:ring-1 focus:ring-primary/40"
        />
      </div>
      <span class="text-xs font-mono text-on-surface-variant">{{ filteredPrs.length }} PRs</span>
    </div>

    <!-- PR list -->
    <div class="space-y-3">
      <PrCard v-for="pr in filteredPrs" :key="`${pr.repo}#${pr.number}`" :pr="pr" />
    </div>

    <EmptyState v-if="!filteredPrs.length" icon="merge" message="No pull requests match your filters" />
  </div>
</template>
