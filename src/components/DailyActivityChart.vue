<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { formatUtcDateShort, formatUtcWeekdayShort, minutesToHours } from '../utils/format.js'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip)

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const props = defineProps({
  minutesByDay: Object,
})

const emit = defineEmits(['day-click'])

const minWidthPx = computed(() => {
  const n = Object.keys(props.minutesByDay || {}).length
  return n * 52
})

const chartData = computed(() => {
  if (!props.minutesByDay) return { labels: [], datasets: [] }
  const entries = Object.entries(props.minutesByDay)
  return {
    labels: entries.map(([date]) => [formatUtcWeekdayShort(date), formatUtcDateShort(date)]),
    datasets: [{
      data: entries.map(([, bucket]) => minutesToHours(bucket.activeMinutes ?? bucket.minutes)),
      backgroundColor: getCssVar('--color-primary'),
      borderRadius: 3,
      barPercentage: 0.7,
    }],
  }
})

const chartOptions = computed(() => {
  const outline = getCssVar('--color-outline')
  const fontMono = getCssVar('--font-mono')
  return {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_evt, elements) => {
      if (!elements.length) return
      const idx = elements[0].index
      const dateKey = Object.keys(props.minutesByDay)[idx]
      emit('day-click', dateKey)
    },
    onHover: (evt, elements) => {
      evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y}h`,
        },
        backgroundColor: getCssVar('--color-surface-container'),
        titleColor: getCssVar('--color-on-surface'),
        bodyColor: getCssVar('--color-on-surface-variant'),
        borderColor: getCssVar('--color-outline-variant'),
        borderWidth: 1,
        padding: 8,
        cornerRadius: 4,
      },
      legend: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: outline, font: { size: 10, family: fontMono } },
        border: { display: false },
      },
      y: {
        grid: { color: getCssVar('--color-outline-variant') + '26' },
        ticks: {
          color: outline,
          font: { size: 10, family: fontMono },
          callback: (v) => `${v}h`,
        },
        border: { display: false },
      },
    },
  }
})
</script>

<template>
  <div class="bg-surface-container-high rounded-xl p-5">
    <div class="flex items-center gap-2 mb-4">
      <span class="material-symbols-outlined text-lg text-primary">bar_chart</span>
      <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Daily Activity</span>
    </div>
    <div class="h-48 overflow-x-auto">
      <div class="h-full" :style="{ minWidth: minWidthPx + 'px' }">
        <Bar :data="chartData" :options="chartOptions" />
      </div>
    </div>
  </div>
</template>
