<script setup>
import { computed, ref } from 'vue'
import { formatSec, formatUtcHm, formatUtcHms } from '../utils/format.js'

const props = defineProps({
  session: { type: Object, required: true },
})

const emit = defineEmits(['timeline-click'])

const VIEW_W = 1000
const STRIP_H = 28
const AXIS_H = 12
const VIEW_H = STRIP_H + AXIS_H

const startMs = computed(() => new Date(props.session.createdAt).getTime())
const endMs = computed(() => new Date(props.session.lastActivityAt).getTime())
const totalSec = computed(() => Math.max(1, (endMs.value - startMs.value) / 1000))

const PRIMARY = 'var(--color-primary)'
const PRIMARY_CONTAINER = 'var(--color-primary-container)'
const GAP_FILL = {
  user_pause: 'var(--color-tertiary)',
  tool_runtime: 'color-mix(in srgb, var(--color-secondary) 40%, transparent)',
  inference: 'color-mix(in srgb, var(--color-on-surface-variant) 30%, transparent)',
  same_turn: 'var(--color-outline-variant)',
}

function tag(arr, kind) {
  return (arr || []).map((data, idx) => ({
    kind,
    idx,
    data,
    startMs: new Date(data.startedAt).getTime(),
  }))
}

const rects = computed(() => {
  const merged = [
    ...tag(props.session.segments, 'segment'),
    ...tag(props.session.gaps, 'gap'),
  ].sort((a, b) => a.startMs - b.startMs)

  const span = (endMs.value - startMs.value) / 1000
  const scale = span > 0 ? VIEW_W / span : 0
  let segmentPaint = 0

  return merged.map((item) => {
    const offsetSec = (item.startMs - startMs.value) / 1000
    const x = Math.max(0, Math.min(VIEW_W, offsetSec * scale))
    const w = Math.max(1, item.data.sec * scale)
    const fill =
      item.kind === 'segment'
        ? (segmentPaint++ % 2 === 0 ? PRIMARY : PRIMARY_CONTAINER)
        : (GAP_FILL[item.data.kind] || GAP_FILL.same_turn)
    return { ...item, x, w, fill }
  })
})

const ticks = computed(() => {
  const count = 5
  const out = []
  for (let i = 0; i < count; i += 1) {
    const frac = i / (count - 1)
    const ms = startMs.value + frac * (endMs.value - startMs.value)
    out.push({ x: frac * VIEW_W, label: formatUtcHm(new Date(ms)) })
  }
  return out
})

const hovered = ref(null)

function onEnter(item, evt) {
  const rect = evt.currentTarget.ownerSVGElement.getBoundingClientRect()
  const itemRect = evt.currentTarget.getBoundingClientRect()
  hovered.value = {
    item,
    x: itemRect.left - rect.left + itemRect.width / 2,
    y: itemRect.top - rect.top,
  }
}

function onLeave() {
  hovered.value = null
}

function onClick(item) {
  emit('timeline-click', item)
}

const tooltipText = computed(() => {
  if (!hovered.value) return null
  const { item } = hovered.value
  const start = formatUtcHms(item.data.startedAt)
  const dur = formatSec(item.data.sec)
  if (item.kind === 'segment') {
    const n = item.data.messageCount
    return `${start} · ${dur} · ${n} message${n === 1 ? '' : 's'}`
  }
  const credited = formatSec(item.data.creditedSec)
  return `${start} · ${dur} · ${item.data.kind} · credited ${credited} of ${dur}`
})
</script>

<template>
  <div class="bg-surface-container-high rounded-xl p-5">
    <div class="flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-lg text-primary">timeline</span>
      <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Session Timeline</span>
    </div>

    <div class="relative">
      <svg
        v-if="rects.length"
        :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
        preserveAspectRatio="none"
        class="w-full h-10 block"
      >
        <rect
          v-for="item in rects"
          :key="`${item.kind}-${item.idx}`"
          :x="item.x"
          :y="0"
          :width="item.w"
          :height="STRIP_H"
          :fill="item.fill"
          class="cursor-pointer transition-opacity hover:opacity-80"
          @mouseenter="onEnter(item, $event)"
          @mouseleave="onLeave"
          @click="onClick(item)"
        />
        <line
          v-for="t in ticks"
          :key="`tick-${t.x}`"
          :x1="t.x"
          :x2="t.x"
          :y1="STRIP_H"
          :y2="STRIP_H + 3"
          stroke="var(--color-outline-variant)"
          stroke-width="1"
        />
        <text
          v-for="t in ticks"
          :key="`label-${t.x}`"
          :x="t.x"
          :y="VIEW_H - 1"
          :text-anchor="t.x === 0 ? 'start' : t.x === VIEW_W ? 'end' : 'middle'"
          fill="var(--color-outline)"
          font-size="8"
          font-family="var(--font-mono)"
        >{{ t.label }}</text>
      </svg>
      <p v-else class="text-xs text-on-surface-variant py-2">No timeline data for this session.</p>

      <div
        v-if="hovered && tooltipText"
        class="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full px-2 py-1 rounded bg-surface-container-highest text-[0.6875rem] font-mono text-on-surface whitespace-nowrap shadow-lg border border-outline-variant/30"
        :style="{ left: hovered.x + 'px', top: (hovered.y - 4) + 'px' }"
      >
        {{ tooltipText }}
      </div>
    </div>

    <div class="flex flex-wrap gap-3 mt-3 text-[0.625rem] font-mono text-on-surface-variant">
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-primary"></span>Activity</span>
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-tertiary"></span>User pause</span>
    </div>
  </div>
</template>
