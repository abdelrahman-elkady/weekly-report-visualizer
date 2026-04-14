<script setup>
import { computed } from 'vue'
import { getBarColor } from '../utils/categories.js'
import { minutesToHours } from '../utils/format.js'

const props = defineProps({
  minutesByRepo: Object,
  maxItems: { type: Number, default: 8 },
})

const sorted = computed(() => {
  if (!props.minutesByRepo) return []
  return Object.entries(props.minutesByRepo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, props.maxItems)
    .map(([repo, mins], i) => ({
      repo,
      repoShort: repo.split('/').pop(),
      minutes: mins,
      hours: minutesToHours(mins),
      color: getBarColor(i),
    }))
})

const maxMinutes = computed(() => {
  if (!sorted.value.length) return 1
  return sorted.value[0].minutes
})
</script>

<template>
  <div class="bg-surface-container-high rounded-xl p-5">
    <div class="flex items-center gap-2 mb-4">
      <span class="material-symbols-outlined text-lg text-secondary">folder</span>
      <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Repo Activity</span>
    </div>
    <div class="space-y-3">
      <div v-for="item in sorted" :key="item.repo">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-on-surface truncate mr-2">{{ item.repoShort }}</span>
          <span class="text-xs font-mono text-on-surface-variant whitespace-nowrap">{{ item.hours }}h</span>
        </div>
        <div class="h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{
              width: `${(item.minutes / maxMinutes) * 100}%`,
              backgroundColor: item.color,
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
