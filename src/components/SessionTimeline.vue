<script setup>
import { computed } from 'vue'
import { formatDuration, formatIdleKind, utcDateKey, IDLE_KINDS, IDLE_KIND_COLORS } from '../utils/format.js'

const props = defineProps({
  createdAt: { type: String, required: true },
  lastActivityAt: { type: String, required: true },
  segments: { type: Array, default: () => [] },
  gaps: { type: Array, default: () => [] },
})

function hatchedBg(color) {
  return `repeating-linear-gradient(45deg, ${color} 0 4px, ${color}66 4px 8px)`
}

const ACTIVITY_BG = 'var(--color-primary)'

const parsed = computed(() => {
  const startMs = new Date(props.createdAt).getTime()
  const endMs = new Date(props.lastActivityAt).getTime()
  return {
    totalSec: Math.max(1, (endMs - startMs) / 1000),
    sameDay: utcDateKey(props.createdAt) === utcDateKey(props.lastActivityAt),
  }
})

function formatAxis(iso) {
  const d = new Date(iso)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  if (parsed.value.sameDay) return `${hh}:${mm}`
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${mo}-${dd} ${hh}:${mm}`
}

const axis = computed(() => ({
  start: formatAxis(props.createdAt),
  end: formatAxis(props.lastActivityAt),
}))

const items = computed(() => {
  const merged = [
    ...props.segments.map(s => ({ kind: 'segment', ...s })),
    ...props.gaps.map(g => ({ ...g })),
  ]
  merged.sort((a, b) => (a.startedAt || '').localeCompare(b.startedAt || ''))
  const total = parsed.value.totalSec
  const mapped = merged.map(item => {
    const isGap = item.kind !== 'segment'
    return {
      pct: (item.sec / total) * 100,
      background: isGap ? hatchedBg(IDLE_KIND_COLORS[item.kind]) : ACTIVITY_BG,
      tooltip: isGap
        ? `${formatIdleKind(item.kind)} · ${formatDuration(item.sec / 60)} raw (${formatDuration(item.creditedSec / 60)} credited)`
        : `Segment · ${formatDuration(item.sec / 60)} · ${item.messageCount} message${item.messageCount === 1 ? '' : 's'}`,
    }
  })
  if (mapped.length === 0) {
    return [{
      pct: 100,
      background: ACTIVITY_BG,
      tooltip: `Session · ${formatDuration(total / 60)}`,
    }]
  }
  return mapped
})

const legend = [
  { label: 'Activity', swatch: ACTIVITY_BG },
  ...IDLE_KINDS.map(kind => ({
    label: formatIdleKind(kind),
    swatch: hatchedBg(IDLE_KIND_COLORS[kind]),
  })),
]
</script>

<template>
  <div class="bg-surface-container-high rounded-xl p-5">
    <div class="flex items-center justify-between mb-3 gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-lg text-primary">timeline</span>
        <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Session Timeline</span>
      </div>
      <div class="flex items-center gap-3 flex-wrap">
        <div
          v-for="l in legend"
          :key="l.label"
          class="flex items-center gap-1.5 text-[0.6875rem] font-mono text-on-surface-variant"
        >
          <span class="w-3 h-3 rounded-sm inline-block" :style="{ background: l.swatch }"></span>
          <span>{{ l.label }}</span>
        </div>
      </div>
    </div>

    <div class="flex w-full h-6 rounded overflow-hidden bg-surface-container-lowest">
      <div
        v-for="(it, idx) in items"
        :key="idx"
        class="h-full shrink-0"
        :style="{ width: it.pct + '%', minWidth: '2px', background: it.background }"
        :title="it.tooltip"
      ></div>
    </div>

    <div class="flex justify-between mt-2 text-[0.6875rem] font-mono text-on-surface-variant">
      <span>{{ axis.start }}</span>
      <span>{{ axis.end }}</span>
    </div>
  </div>
</template>
