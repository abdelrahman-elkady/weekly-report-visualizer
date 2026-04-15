<script setup>
import { ref } from 'vue'
import { formatDate, formatNumber } from '../utils/format.js'
import CorrelationBadge from './CorrelationBadge.vue'

defineProps({
  pr: Object,
})

const expanded = ref(false)
</script>

<template>
  <div class="bg-surface-container-high rounded-xl overflow-hidden">
    <!-- Header -->
    <button
      @click="expanded = !expanded"
      class="w-full px-5 py-4 flex items-start gap-4 hover:bg-surface-container-highest/30 transition-colors text-left"
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <a
            v-if="pr.url"
            :href="pr.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-mono text-primary hover:underline"
            @click.stop
          >#{{ pr.number }}</a>
          <span v-else class="text-sm font-mono text-primary">#{{ pr.number }}</span>
          <span class="text-sm text-on-surface truncate">{{ pr.title }}</span>
          <a
            v-if="pr.url"
            :href="pr.url"
            target="_blank"
            rel="noopener noreferrer"
            class="text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
            @click.stop
            title="Open on GitHub"
          >
            <span class="material-symbols-outlined text-sm">open_in_new</span>
          </a>
        </div>
        <div class="flex items-center gap-3 text-xs text-on-surface-variant font-mono">
          <span class="px-2 py-0.5 rounded-full bg-surface-container">{{ pr.repoShort }}</span>
          <span class="text-secondary">+{{ formatNumber(pr.additions) }}</span>
          <span class="text-error">-{{ formatNumber(pr.deletions) }}</span>
          <span>{{ formatDate(pr.mergedAt) }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <div v-if="pr.jiraIds?.length" class="flex gap-1">
          <router-link
            v-for="id in pr.jiraIds"
            :key="id"
            :to="{ name: 'tickets', query: { search: id } }"
            @click.stop
            class="text-[0.625rem] font-mono px-1.5 py-0.5 rounded-full bg-tertiary-container text-tertiary hover:bg-tertiary/20 transition-colors"
          >
            {{ id }}
          </router-link>
        </div>
        <span
          class="text-[0.625rem] font-mono px-2 py-0.5 rounded-full"
          :class="pr.kind === 'authored'
            ? 'bg-secondary-container/30 text-secondary'
            : 'bg-primary/15 text-primary'"
        >
          {{ pr.kind === 'authored' ? 'Authored' : 'Reviewed' }}
        </span>
        <span class="material-symbols-outlined text-on-surface-variant text-lg transition-transform" :class="expanded ? 'rotate-180' : ''">
          expand_more
        </span>
      </div>
    </button>

    <!-- Expanded content -->
    <div v-if="expanded" class="px-5 pb-4 border-t border-outline-variant/15">
      <div v-if="pr.correlatedSessions?.length" class="mt-4">
        <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-2">Correlated Sessions</p>
        <CorrelationBadge :matches="pr.correlatedSessions" type="session" />
      </div>
      <div v-else class="mt-4 flex items-center gap-2 py-3 text-on-surface-variant">
        <span class="material-symbols-outlined text-lg opacity-40">link_off</span>
        <span class="text-xs">{{ pr.kind === 'review' ? 'Correlation not available for reviewed PRs' : 'No correlated sessions' }}</span>
      </div>

      <div v-if="pr.files?.length" class="mt-4">
        <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant mb-2">Files Changed ({{ pr.files.length }})</p>
        <div class="max-h-32 overflow-y-auto space-y-0.5">
          <p v-for="file in pr.files" :key="file" class="text-xs font-mono text-on-surface-variant truncate">{{ file }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
