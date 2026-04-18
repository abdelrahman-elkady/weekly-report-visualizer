<script setup>
import { computed, ref } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarElement,
  BarController,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
} from 'chart.js'
import { formatUtcDateShort, formatUtcWeekdayShort, minutesToHours } from '../utils/format.js'

ChartJS.register(
  BarElement,
  BarController,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
)

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const props = defineProps({
  minutesByDay: Object,
})

const emit = defineEmits(['day-click'])

const METRICS = [
  { key: 'sessions', label: 'Sessions', swatchClass: 'bg-primary' },
  { key: 'hours', label: 'Hours', swatchClass: 'bg-tertiary' },
]

const visible = ref({ sessions: true, hours: true })
function toggle(key) {
  const onlyOneOn = visible.value[key] && Object.values(visible.value).filter(Boolean).length === 1
  if (onlyOneOn) return
  visible.value[key] = !visible.value[key]
}

const entries = computed(() => Object.entries(props.minutesByDay || {}))
const labels = computed(() =>
  entries.value.map(([date]) => [formatUtcWeekdayShort(date), formatUtcDateShort(date)])
)
const sessionsData = computed(() => entries.value.map(([, b]) => b.sessions))
const hoursData = computed(() =>
  entries.value.map(([, b]) => minutesToHours(b.activeMinutes ?? b.minutes))
)

function niceMax(v) {
  if (!isFinite(v) || v <= 0) return 1
  const padded = v * 1.1
  const pow = Math.pow(10, Math.floor(Math.log10(padded)))
  const n = padded / pow
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10
  return nice * pow
}

const maxSessions = computed(() =>
  Math.max(1, Math.ceil(niceMax(Math.max(0, ...sessionsData.value))))
)
const maxHours = computed(() => niceMax(Math.max(0, ...hoursData.value)))

const minWidthPx = computed(() => entries.value.length * 52)

function buildDatasets({ withData }) {
  return [
    {
      type: 'bar',
      label: 'Sessions',
      yAxisID: 'ySessions',
      data: withData ? sessionsData.value : [],
      backgroundColor: withData ? getCssVar('--color-primary') : 'transparent',
      borderColor: 'transparent',
      borderRadius: 3,
      barPercentage: 0.7,
      order: 2,
      hidden: !visible.value.sessions,
    },
    {
      type: 'line',
      label: 'Hours',
      yAxisID: 'yHours',
      data: withData ? hoursData.value : [],
      borderColor: withData ? getCssVar('--color-tertiary') : 'transparent',
      backgroundColor: withData ? getCssVar('--color-tertiary') : 'transparent',
      pointRadius: withData ? 3 : 0,
      pointHoverRadius: withData ? 5 : 0,
      tension: 0.3,
      borderWidth: 2,
      order: 1,
      hidden: !visible.value.hours,
    },
  ]
}

const mainChartData = computed(() => ({
  labels: labels.value,
  datasets: buildDatasets({ withData: true }),
}))

const sideChartData = computed(() => ({
  labels: labels.value,
  datasets: buildDatasets({ withData: false }),
}))

function buildScales({ showSessionsAxis, showHoursAxis }) {
  const outline = getCssVar('--color-outline')
  const fontMono = getCssVar('--font-mono')
  return {
    x: {
      grid: { display: false },
      ticks: { color: outline, font: { size: 10, family: fontMono } },
      border: { display: false },
    },
    ySessions: {
      type: 'linear',
      position: 'left',
      beginAtZero: true,
      max: maxSessions.value,
      display: showSessionsAxis && visible.value.sessions,
      grid: { color: getCssVar('--color-outline-variant') + '26' },
      ticks: {
        color: outline,
        font: { size: 10, family: fontMono },
        precision: 0,
        stepSize: maxSessions.value <= 10 ? 1 : Math.ceil(maxSessions.value / 5),
      },
      border: { display: false },
    },
    yHours: {
      type: 'linear',
      position: 'right',
      beginAtZero: true,
      max: maxHours.value,
      display: showHoursAxis && visible.value.hours,
      grid: { drawOnChartArea: false },
      ticks: {
        color: outline,
        font: { size: 10, family: fontMono },
        callback: (v) => `${v}h`,
      },
      border: { display: false },
    },
  }
}

const mainChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  onClick: (_evt, elements) => {
    if (!elements.length) return
    const dateKey = entries.value[elements[0].index]?.[0]
    if (dateKey) emit('day-click', dateKey)
  },
  onHover: (evt, elements) => {
    evt.native.target.style.cursor = elements.length ? 'pointer' : 'default'
  },
  plugins: {
    tooltip: {
      callbacks: {
        label: (ctx) => {
          const v = ctx.parsed.y
          if (ctx.dataset.yAxisID === 'yHours') return `${v}h`
          return `${v} session${v === 1 ? '' : 's'}`
        },
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
  scales: buildScales({ showSessionsAxis: false, showHoursAxis: false }),
}))

function buildSideAxisOptions({ showSessionsAxis, showHoursAxis }) {
  const scales = buildScales({ showSessionsAxis, showHoursAxis })
  return {
    responsive: true,
    maintainAspectRatio: false,
    events: [],
    animation: false,
    plugins: { tooltip: { enabled: false }, legend: { display: false } },
    scales: {
      ...scales,
      x: { ...scales.x, ticks: { ...scales.x.ticks, color: 'transparent' } },
    },
  }
}

const leftAxisOptions = computed(() =>
  buildSideAxisOptions({ showSessionsAxis: true, showHoursAxis: false })
)
const rightAxisOptions = computed(() =>
  buildSideAxisOptions({ showSessionsAxis: false, showHoursAxis: true })
)
</script>

<template>
  <div class="bg-surface-container-high rounded-xl p-5">
    <div class="flex items-center justify-between mb-4 gap-3">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-lg text-primary">bar_chart</span>
        <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Daily Activity</span>
      </div>
      <div class="flex items-center gap-3">
        <button
          v-for="m in METRICS"
          :key="m.key"
          type="button"
          class="flex items-center gap-1.5 text-xs font-mono transition-opacity hover:opacity-80"
          :class="visible[m.key] ? 'text-on-surface' : 'text-on-surface-variant'"
          @click="toggle(m.key)"
        >
          <span
            class="w-2.5 h-2.5 rounded-sm"
            :class="visible[m.key] ? m.swatchClass : 'bg-on-surface-variant/30'"
          ></span>
          <span :class="{ 'line-through': !visible[m.key] }">{{ m.label }}</span>
        </button>
      </div>
    </div>
    <div class="flex h-48">
      <div class="w-12 shrink-0" v-show="visible.sessions">
        <Bar :data="sideChartData" :options="leftAxisOptions" />
      </div>
      <div class="flex-1 min-w-0 overflow-x-auto">
        <div class="h-full" :style="{ minWidth: minWidthPx + 'px' }">
          <Bar :data="mainChartData" :options="mainChartOptions" />
        </div>
      </div>
      <div class="w-14 shrink-0" v-show="visible.hours">
        <Bar :data="sideChartData" :options="rightAxisOptions" />
      </div>
    </div>
  </div>
</template>
