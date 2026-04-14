<script setup>
import { computed } from 'vue'
import { getBarColor } from '../utils/categories.js'

const props = defineProps({
  toolCounts: Object,
})

const sorted = computed(() => {
  if (!props.toolCounts) return []
  return Object.entries(props.toolCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count], i) => ({ tool, count, color: getBarColor(i) }))
})

const maxCount = computed(() => sorted.value[0]?.count || 1)
</script>

<template>
  <div>
    <div class="flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-lg text-primary">build</span>
      <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Tool Usage</span>
    </div>
    <div class="space-y-2">
      <div v-for="item in sorted" :key="item.tool" class="flex items-center gap-3">
        <span class="text-xs font-mono text-on-surface-variant w-16 truncate text-right">{{ item.tool }}</span>
        <div class="flex-1 h-1.5 bg-surface-container-lowest rounded-full overflow-hidden">
          <div
            class="h-full rounded-full"
            :style="{ width: `${(item.count / maxCount) * 100}%`, backgroundColor: item.color }"
          />
        </div>
        <span class="text-xs font-mono text-on-surface w-6 text-right">{{ item.count }}</span>
      </div>
    </div>
  </div>
</template>
