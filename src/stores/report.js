import { ref, computed } from 'vue'
import { validateReport } from '../utils/validation.js'

const STORAGE_KEY = 'weekly-report-data'

const reportData = ref(null)
const sidebarCollapsed = ref(false)

const isLoaded = computed(() => reportData.value !== null)

function loadReport(jsonString) {
  let data
  try {
    data = JSON.parse(jsonString)
  } catch {
    return { success: false, errors: ['Invalid JSON: could not parse file'] }
  }

  const result = validateReport(data)
  if (!result.valid) {
    return { success: false, errors: result.errors }
  }

  reportData.value = data
  localStorage.setItem(STORAGE_KEY, jsonString)
  return { success: true }
}

function loadFromStorage() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return false
  try {
    const data = JSON.parse(raw)
    const result = validateReport(data)
    if (result.valid) {
      reportData.value = data
      return true
    }
  } catch {
    // corrupted storage — ignore
  }
  localStorage.removeItem(STORAGE_KEY)
  return false
}

function clearReport() {
  reportData.value = null
  localStorage.removeItem(STORAGE_KEY)
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

export function useReportStore() {
  return {
    reportData,
    isLoaded,
    sidebarCollapsed,
    loadReport,
    loadFromStorage,
    clearReport,
    toggleSidebar,
  }
}
