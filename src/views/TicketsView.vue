<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { truncateId } from '../utils/format.js'
import EmptyState from '../components/EmptyState.vue'

const route = useRoute()
const { reportData, enrichedTickets } = useReportStore()

const searchQuery = ref('')

watch(() => route.query, (q) => {
  searchQuery.value = q.search || ''
}, { immediate: true })
const sortBy = ref('sessions')
const expandedId = ref(null)

const tickets = enrichedTickets

const hasEnrichment = computed(() => {
  const issues = reportData.value?.jiraIssues
  return !!issues && Object.keys(issues).length > 0
})

const filteredTickets = computed(() => {
  let result = tickets.value

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(t =>
      t.id?.toLowerCase().includes(q) ||
      t.title?.toLowerCase().includes(q)
    )
  }

  const key = sortBy.value
  result = [...result].sort((a, b) => {
    if (key === 'sessions') return (b.sessionIds?.length || 0) - (a.sessionIds?.length || 0)
    if (key === 'prs') return (b.prKeys?.length || 0) - (a.prKeys?.length || 0)
    if (key === 'id') return a.id.localeCompare(b.id)
    return 0
  })

  return result
})

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

const sortOptions = [
  { value: 'sessions', label: 'Most Sessions' },
  { value: 'prs', label: 'Most PRs' },
  { value: 'id', label: 'Ticket ID' },
]
</script>

<template>
  <div class="p-8">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-on-surface font-headline mb-1">Jira Tickets</h1>
      <p class="text-sm text-on-surface-variant">Tickets referenced across sessions and pull requests</p>
    </div>

    <!-- Enrichment notice -->
    <div v-if="!hasEnrichment" class="bg-surface-container-low rounded-xl p-4 mb-6 flex items-start gap-3">
      <span class="material-symbols-outlined text-lg text-tertiary mt-0.5">info</span>
      <p class="text-xs text-on-surface-variant leading-relaxed">
        Ticket details can be enriched by running the report with Atlassian MCP integration.
        Without enrichment, only ticket IDs are available.
      </p>
    </div>

    <!-- Filters -->
    <div class="flex items-center gap-4 mb-6">
      <div class="relative flex-1 max-w-sm">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search tickets..."
          class="w-full bg-surface-container-lowest text-on-surface text-sm pl-10 pr-4 py-2 rounded-lg outline-none placeholder:text-outline focus:ring-1 focus:ring-primary/40"
        />
      </div>
      <select
        v-model="sortBy"
        class="bg-surface-container-lowest text-on-surface text-xs font-mono px-3 py-2 rounded-lg outline-none cursor-pointer"
      >
        <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <span class="text-xs font-mono text-on-surface-variant">{{ filteredTickets.length }} tickets</span>
    </div>

    <!-- Table header -->
    <div class="grid grid-cols-12 gap-4 px-4 py-2 text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-1">
      <div class="col-span-2">ID</div>
      <div class="col-span-4">Title</div>
      <div class="col-span-2">Status</div>
      <div class="col-span-2 text-center">Sessions</div>
      <div class="col-span-2 text-center">PRs</div>
    </div>

    <!-- Rows -->
    <div v-for="ticket in filteredTickets" :key="ticket.id">
      <div
        @click="toggleExpand(ticket.id)"
        class="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-surface-container-high/60 transition-colors cursor-pointer items-center rounded-lg"
      >
        <div class="col-span-2 text-sm font-mono text-primary">{{ ticket.id }}</div>
        <div class="col-span-4 text-sm text-on-surface truncate">
          <span v-if="ticket.title">{{ ticket.title }}</span>
          <span v-else class="text-on-surface-variant italic">Not enriched</span>
        </div>
        <div class="col-span-2">
          <span v-if="ticket.status" class="text-xs px-2 py-0.5 rounded-full bg-secondary-container/30 text-secondary font-mono">
            {{ ticket.status }}
          </span>
          <span v-else class="text-xs text-on-surface-variant">N/A</span>
        </div>
        <div class="col-span-2 text-center text-sm font-mono text-on-surface">{{ ticket.sessionIds?.length || 0 }}</div>
        <div class="col-span-2 text-center text-sm font-mono text-on-surface">{{ ticket.prKeys?.length || 0 }}</div>
      </div>

      <!-- Expanded detail -->
      <div v-if="expandedId === ticket.id" class="px-4 pb-4 ml-4">
        <div class="bg-surface-container-high rounded-lg p-4 space-y-3">
          <div v-if="ticket.type || ticket.assignee" class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-on-surface-variant">
            <div v-if="ticket.type">
              <span class="font-mono uppercase tracking-wider mr-2">Type</span>
              <span class="text-on-surface">{{ ticket.type }}</span>
            </div>
            <div v-if="ticket.assignee">
              <span class="font-mono uppercase tracking-wider mr-2">Assignee</span>
              <span class="text-on-surface">{{ ticket.assignee }}</span>
            </div>
          </div>
          <div v-if="ticket.sessionIds?.length">
            <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-2">Linked Sessions</p>
            <div class="flex flex-wrap gap-1.5">
              <router-link
                v-for="sid in ticket.sessionIds"
                :key="sid"
                :to="{ name: 'session-detail', params: { id: sid } }"
                class="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-container text-primary hover:bg-primary/15 transition-colors"
              >
                {{ truncateId(sid) }}
              </router-link>
            </div>
          </div>
          <div v-if="ticket.prKeys?.length">
            <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-2">Linked PRs</p>
            <div class="flex flex-wrap gap-1.5">
              <router-link
                v-for="key in ticket.prKeys"
                :key="key"
                :to="{ name: 'prs', query: { search: key } }"
                class="text-xs font-mono px-2 py-0.5 rounded-full bg-surface-container text-secondary hover:bg-secondary/15 transition-colors"
              >
                {{ key }}
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <EmptyState v-if="!filteredTickets.length" icon="confirmation_number" message="No tickets found" />
  </div>
</template>
