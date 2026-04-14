<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useReportStore } from '../stores/report.js'

const router = useRouter()
const { loadReport } = useReportStore()

const isDragging = ref(false)
const errors = ref([])
const fileInput = ref(null)

function handleFile(file) {
  errors.value = []
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const result = loadReport(e.target.result)
    if (result.success) {
      router.push({ name: 'summary' })
    } else {
      errors.value = result.errors
    }
  }
  reader.onerror = () => {
    errors.value = ['Failed to read file']
  }
  reader.readAsText(file)
}

function onDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  handleFile(file)
}

function onFileSelect(e) {
  const file = e.target.files?.[0]
  handleFile(file)
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-8">
    <div class="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
      <!-- Left: Feature highlights -->
      <div>
        <p class="text-[0.6875rem] font-mono uppercase tracking-wider text-primary mb-3">
          Report Visualizer
        </p>
        <h1 class="text-4xl font-bold text-on-surface mb-4 font-headline leading-tight">
          Weekly Activity<br />Dashboard
        </h1>
        <p class="text-on-surface-variant text-sm mb-8 leading-relaxed">
          Visualize your weekly activity report data. Session analysis,
          PR tracking, and ticket correlation — all client-side.
        </p>

        <div class="space-y-5">
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-primary text-xl mt-0.5">lock</span>
            <div>
              <p class="text-sm font-medium text-on-surface">Local-only processing</p>
              <p class="text-xs text-on-surface-variant">All computation occurs within the client sandbox. Zero server-side storage.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-secondary text-xl mt-0.5">link</span>
            <div>
              <p class="text-sm font-medium text-on-surface">Session-PR correlation</p>
              <p class="text-xs text-on-surface-variant">Cross-reference sessions with pull requests and Jira tickets.</p>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="material-symbols-outlined text-tertiary text-xl mt-0.5">verified</span>
            <div>
              <p class="text-sm font-medium text-on-surface">Schema validation</p>
              <p class="text-xs text-on-surface-variant">Automatic integrity checks against the report schema.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Drop zone -->
      <div>
        <div
          class="rounded-xl p-8 flex flex-col items-center justify-center min-h-[320px] transition-colors cursor-pointer"
          :class="isDragging
            ? 'bg-primary/10 ring-2 ring-primary/40'
            : 'bg-surface-container-low hover:bg-surface-container'"
          @dragover.prevent="isDragging = true"
          @dragleave="isDragging = false"
          @drop.prevent="onDrop"
          @click="fileInput?.click()"
        >
          <span class="material-symbols-outlined text-5xl mb-4" :class="isDragging ? 'text-primary' : 'text-on-surface-variant'">
            upload_file
          </span>
          <p class="text-on-surface text-sm font-medium mb-1">
            Drop report.json here
          </p>
          <p class="text-on-surface-variant text-xs mb-6">
            Drag and drop your report file or click to browse.
          </p>
          <label
            class="px-5 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg cursor-pointer hover:bg-primary/90 transition-colors"
            @click.stop
          >
            Select Source File
            <input
              ref="fileInput"
              type="file"
              accept=".json"
              class="hidden"
              @change="onFileSelect"
            />
          </label>
        </div>

        <!-- Validation errors -->
        <div v-if="errors.length" class="mt-4 p-4 bg-error-container/20 rounded-lg">
          <p class="text-error text-sm font-medium mb-2">
            <span class="material-symbols-outlined text-base align-text-bottom mr-1">error</span>
            Validation failed
          </p>
          <ul class="text-error/80 text-xs space-y-1">
            <li v-for="(err, i) in errors" :key="i">{{ err }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
