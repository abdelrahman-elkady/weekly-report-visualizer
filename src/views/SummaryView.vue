<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { formatDateRange, formatNumber, minutesToHours, isHighIdleRatio } from '../utils/format.js'
import MetricCard from '../components/MetricCard.vue'
import CategoryBars from '../components/CategoryBars.vue'
import DailyActivityChart from '../components/DailyActivityChart.vue'
import RepoBreakdown from '../components/RepoBreakdown.vue'

const router = useRouter()
const { reportData } = useReportStore()

const dateRange = computed(() =>
  formatDateRange(reportData.value?.windowStart, reportData.value?.windowEnd)
)

const activeCategoryMinutes = computed(() =>
  reportData.value?.totals?.activeCategoryMinutes ?? reportData.value?.totals?.categoryMinutes
)

const activeMinutesByRepo = computed(() =>
  reportData.value?.totals?.activeMinutesByRepo ?? reportData.value?.totals?.minutesByRepo
)

const totalHours = computed(() => {
  const cm = activeCategoryMinutes.value
  if (!cm) return 0
  const totalMin = Object.values(cm).reduce((a, b) => a + b, 0)
  return minutesToHours(totalMin)
})

const highIdleCount = computed(() => {
  return reportData.value?.sessions?.filter(s => isHighIdleRatio(s.durationMin, s.activeDurationMin)).length || 0
})

// Ticket table pagination
const ticketPage = ref(1)
const ticketsPerPage = 20

const tickets = computed(() => reportData.value?.tickets || [])

const paginatedTickets = computed(() => {
  const start = (ticketPage.value - 1) * ticketsPerPage
  return tickets.value.slice(start, start + ticketsPerPage)
})

const totalTicketPages = computed(() =>
  Math.ceil(tickets.value.length / ticketsPerPage) || 1
)
</script>

<template>
  <div class="p-8">
    <!-- Header -->
    <div class="mb-8">
      <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-primary mb-1">{{ dateRange }}</p>
      <h1 class="text-3xl font-bold text-on-surface font-headline">Summary Overview</h1>
    </div>

    <!-- Metric cards -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <MetricCard
        icon="terminal"
        label="Total Sessions"
        :value="formatNumber(reportData.totals.sessions)"
        color="primary"
        clickable
        @click="router.push({ name: 'sessions' })"
      />
      <MetricCard
        icon="merge"
        label="Authored PRs"
        :value="formatNumber(reportData.totals.prs)"
        color="secondary"
        clickable
        @click="router.push({ name: 'prs', query: { tab: 'authored' } })"
      />
      <MetricCard
        icon="rate_review"
        label="Reviewed PRs"
        :value="formatNumber(reportData.totals.reviewedPrs)"
        color="tertiary"
        clickable
        @click="router.push({ name: 'prs', query: { tab: 'reviewed' } })"
      />
      <MetricCard
        icon="schedule"
        label="Total Hours"
        :value="totalHours"
        unit="hrs"
        color="primary"
      >
        <p v-if="highIdleCount" class="text-xs text-tertiary mt-2 flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">warning</span>
          {{ highIdleCount }} session{{ highIdleCount > 1 ? 's' : '' }} with high idle ratio (&lt;45% active)
        </p>
      </MetricCard>
    </div>

    <!-- Main grid -->
    <div class="grid grid-cols-12 gap-6 mb-8">
      <!-- Left: Category distribution -->
      <div class="col-span-7">
        <CategoryBars :categoryMinutes="activeCategoryMinutes" @categoryClick="cat => router.push({ name: 'sessions', query: { category: cat } })" />
      </div>

      <!-- Right: Daily + Repo -->
      <div class="col-span-5 space-y-6">
        <DailyActivityChart :minutesByDay="reportData.totals.minutesByDay" @day-click="d => router.push({ path: '/sessions', query: { date: d } })" />
        <RepoBreakdown :minutesByRepo="activeMinutesByRepo" @repoClick="repo => router.push({ name: 'sessions', query: { repo } })" />
      </div>
    </div>

    <!-- Ticket table -->
    <div class="bg-surface-container-high rounded-xl p-5" v-if="tickets.length">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-lg text-tertiary">confirmation_number</span>
          <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Ticket Overview</span>
        </div>
        <span class="text-xs text-on-surface-variant font-mono">{{ tickets.length }} tickets</span>
      </div>

      <!-- Header row -->
      <div class="grid grid-cols-12 gap-4 px-3 py-2 text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">
        <div class="col-span-2">ID</div>
        <div class="col-span-4">Title</div>
        <div class="col-span-2">Status</div>
        <div class="col-span-2 text-center">Sessions</div>
        <div class="col-span-2 text-center">PRs</div>
      </div>

      <!-- Rows -->
      <div
        v-for="ticket in paginatedTickets"
        :key="ticket.id"
        class="grid grid-cols-12 gap-4 px-3 py-3 hover:bg-surface-container-highest/50 transition-colors items-center"
      >
        <div class="col-span-2">
          <router-link
            :to="{ name: 'tickets', query: { search: ticket.id } }"
            class="text-sm font-mono text-primary hover:underline"
            @click.stop
          >{{ ticket.id }}</router-link>
        </div>
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
        <div class="col-span-2 text-center text-sm font-mono text-on-surface">{{ ticket.sessionIds.length }}</div>
        <div class="col-span-2 text-center text-sm font-mono text-on-surface">{{ ticket.prKeys.length }}</div>
      </div>

      <!-- Pagination -->
      <div v-if="totalTicketPages > 1" class="flex items-center justify-center gap-4 mt-4 pt-4">
        <button
          @click="ticketPage = Math.max(1, ticketPage - 1)"
          :disabled="ticketPage === 1"
          class="text-xs font-mono text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
        >
          <span class="material-symbols-outlined text-base">chevron_left</span>
        </button>
        <span class="text-xs font-mono text-on-surface-variant">{{ ticketPage }} / {{ totalTicketPages }}</span>
        <button
          @click="ticketPage = Math.min(totalTicketPages, ticketPage + 1)"
          :disabled="ticketPage === totalTicketPages"
          class="text-xs font-mono text-on-surface-variant hover:text-on-surface disabled:opacity-30 transition-colors"
        >
          <span class="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>
    </div>
  </div>
</template>
