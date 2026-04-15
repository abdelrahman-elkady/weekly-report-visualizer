<script setup>
import { computed } from 'vue'
import { getCategoryInfo, getBarColor } from '../utils/categories.js'
import { minutesToHours } from '../utils/format.js'

const props = defineProps({
  categoryMinutes: Object,
})

const emit = defineEmits(['categoryClick'])

const sorted = computed(() => {
  if (!props.categoryMinutes) return []
  return Object.entries(props.categoryMinutes)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, mins], i) => ({
      category: cat,
      ...getCategoryInfo(cat),
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
      <span class="material-symbols-outlined text-lg text-primary">donut_small</span>
      <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Category Distribution</span>
    </div>
    <div class="space-y-3">
      <div v-for="item in sorted" :key="item.category" class="group cursor-pointer hover:bg-surface-container-highest/30 -mx-2 px-2 py-1 rounded-lg transition-colors" @click="emit('categoryClick', item.category)">
        <div class="flex items-center justify-between mb-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-base" :style="{ color: item.color }">{{ item.icon }}</span>
            <span class="text-xs text-on-surface">{{ item.label }}</span>
          </div>
          <span class="text-xs font-mono text-on-surface-variant">{{ item.hours }}h</span>
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
