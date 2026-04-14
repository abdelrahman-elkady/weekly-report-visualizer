<script setup>
import { useReportStore } from './stores/report.js'
import AppSidebar from './components/AppSidebar.vue'

const { isLoaded, sidebarCollapsed } = useReportStore()
</script>

<template>
  <div class="min-h-screen bg-surface">
    <AppSidebar v-if="isLoaded" />
    <main
      class="min-h-screen transition-all duration-200"
      :class="isLoaded ? (sidebarCollapsed ? 'ml-16' : 'ml-64') : ''"
    >
      <router-view />
    </main>
  </div>
</template>
