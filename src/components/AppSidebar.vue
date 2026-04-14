<script setup>
import { useReportStore } from '../stores/report.js'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const { sidebarCollapsed, toggleSidebar, isLoaded, clearReport } = useReportStore()

function handleClear() {
  clearReport()
  router.push({ name: 'upload' })
}

const navItems = [
  { name: 'summary', label: 'Summary', icon: 'dashboard' },
  { name: 'sessions', label: 'Sessions', icon: 'terminal' },
  { name: 'prs', label: 'Pull Requests', icon: 'merge' },
  { name: 'tickets', label: 'Tickets', icon: 'confirmation_number' },
]

function isActive(item) {
  if (item.name === 'sessions') {
    return route.path.startsWith('/sessions')
  }
  return route.name === item.name
}
</script>

<template>
  <aside
    class="fixed left-0 top-0 h-screen bg-surface-container-low flex flex-col transition-all duration-200 z-30"
    :class="sidebarCollapsed ? 'w-16' : 'w-64'"
  >
    <!-- Header -->
    <div class="flex items-center gap-3 px-4 h-14 shrink-0">
      <button
        @click="toggleSidebar"
        class="text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span class="material-symbols-outlined text-xl">
          {{ sidebarCollapsed ? 'menu' : 'menu_open' }}
        </span>
      </button>
      <span
        v-show="!sidebarCollapsed"
        class="text-sm font-semibold text-on-surface tracking-wide whitespace-nowrap"
      >
        Report Visualizer
      </span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 mt-4 px-2 space-y-1">
      <router-link
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
        :class="isActive(item)
          ? 'bg-surface-container-high text-primary'
          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'"
      >
        <span class="material-symbols-outlined text-xl">{{ item.icon }}</span>
        <span
          v-show="!sidebarCollapsed"
          class="text-[0.6875rem] font-mono uppercase tracking-wider whitespace-nowrap"
        >
          {{ item.label }}
        </span>
      </router-link>
    </nav>

    <!-- Footer -->
    <div class="px-2 pb-4 space-y-1" v-if="isLoaded">
      <button
        @click="handleClear"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
      >
        <span class="material-symbols-outlined text-xl">delete_outline</span>
        <span
          v-show="!sidebarCollapsed"
          class="text-[0.6875rem] font-mono uppercase tracking-wider whitespace-nowrap"
        >
          Clear Data
        </span>
      </button>
    </div>
  </aside>
</template>
