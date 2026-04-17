<script setup>
import { truncateId } from '../utils/format.js'

defineProps({
  matches: Array,
  type: { type: String, default: 'pr' },
})
</script>

<template>
  <div class="space-y-2">
    <div v-for="match in matches" :key="match.key || match.sessionId" class="bg-surface-container rounded-lg p-3">
      <div class="flex items-center justify-between mb-1.5">
        <router-link
          v-if="type === 'session' && match.sessionId"
          :to="{ name: 'session-detail', params: { id: match.sessionId } }"
          class="text-xs font-mono text-primary hover:underline"
        >
          {{ truncateId(match.sessionId) }}
        </router-link>
        <router-link
          v-else-if="type === 'pr' && match.key"
          :to="{ name: 'prs', query: { search: match.key } }"
          class="text-xs font-mono text-primary hover:underline"
        >
          {{ match.key }}
        </router-link>
        <span v-else class="text-xs font-mono text-primary">{{ match.key || match.sessionId }}</span>
        <span class="text-[0.625rem] font-mono text-on-surface-variant">
          Score: {{ match.score }}
        </span>
      </div>
      <div class="flex flex-wrap gap-1">
        <span
          v-for="reason in match.reasons"
          :key="reason"
          class="text-[0.5625rem] font-mono px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant"
        >
          {{ reason }}
        </span>
      </div>
    </div>
  </div>
</template>
