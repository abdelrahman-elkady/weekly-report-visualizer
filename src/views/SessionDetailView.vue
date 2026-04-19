<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useReportStore } from '../stores/report.js'
import { formatDuration, formatSec, formatDate, humanizeActiveReviewReason } from '../utils/format.js'
import { getCategoryInfo } from '../utils/categories.js'
import ConversationLog from '../components/ConversationLog.vue'
import ToolUsageChart from '../components/ToolUsageChart.vue'
import CorrelationBadge from '../components/CorrelationBadge.vue'
import SessionTimeline from '../components/SessionTimeline.vue'

const route = useRoute()
const router = useRouter()
const { reportData } = useReportStore()

const session = computed(() =>
  reportData.value?.sessions?.find(s => s.sessionId === route.params.id)
)

const catInfo = computed(() => getCategoryInfo(session.value?.category))

const CATEGORY_COLOR_CLASSES = {
  primary: 'bg-primary/15 text-primary',
  secondary: 'bg-secondary/15 text-secondary',
  tertiary: 'bg-tertiary/15 text-tertiary',
  error: 'bg-error/15 text-error',
  'on-surface-variant': 'bg-on-surface-variant/15 text-on-surface-variant',
}

const catBadgeClass = computed(() => CATEGORY_COLOR_CLASSES[catInfo.value?.color] || CATEGORY_COLOR_CLASSES.primary)

const showAllFiles = ref(false)
const visibleFiles = computed(() => {
  const files = session.value?.filesTouchedRelative || []
  if (showAllFiles.value) return files
  return files.slice(0, 5)
})
const hiddenFileCount = computed(() => {
  const total = session.value?.filesTouchedRelative?.length || 0
  return Math.max(0, total - 5)
})
</script>

<template>
  <div class="p-8" v-if="session">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-8">
      <button
        @click="router.push({ name: 'sessions' })"
        class="text-on-surface-variant hover:text-on-surface transition-colors"
      >
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="flex-1">
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-mono font-bold text-on-surface">{{ session.sessionId }}</h1>
          <span
            class="text-xs font-mono px-2.5 py-0.5 rounded-full"
            :class="[catBadgeClass, session.category === 'discarded' ? 'border border-dashed border-outline' : '']"
          >
            <span class="material-symbols-outlined text-xs mr-0.5 align-text-bottom">{{ catInfo.icon }}</span>
            {{ catInfo.label }}
          </span>
        </div>
        <div class="flex items-center gap-3 text-xs text-on-surface-variant font-mono">
          <span>{{ session.repoShort }}</span>
          <span class="opacity-30">|</span>
          <span>{{ session.gitBranch }}</span>
          <span class="opacity-30">|</span>
          <span :class="session.needsActiveReview ? 'text-tertiary' : ''">
            {{ formatDuration(session.activeDurationMin) }}
            <span v-if="session.needsActiveReview" class="material-symbols-outlined text-xs align-text-bottom" title="Needs active review">warning</span>
          </span>
        </div>
      </div>
    </div>

    <div
      v-if="session.needsActiveReview"
      class="mb-6 flex items-center gap-3 px-4 py-3 rounded-lg bg-tertiary-container/20 border border-tertiary/30"
    >
      <span class="material-symbols-outlined text-tertiary">schedule</span>
      <span class="text-sm text-on-surface">
        {{ humanizeActiveReviewReason(session.activeReviewReason) }}
        — {{ formatDuration(session.activeDurationMin) }} active of {{ formatDuration(session.durationMin) }} wall-clock
      </span>
    </div>

    <div class="grid grid-cols-12 gap-8">
      <!-- Left: Timeline + Conversation + stats -->
      <div class="col-span-8 space-y-6">
        <SessionTimeline :session="session" />
        <div class="bg-surface-container-low rounded-xl p-6">
          <ConversationLog
            :userMessages="session.userMessages"
            :assistantTexts="session.assistantTexts"
          />
        </div>
      </div>

      <!-- Right: Metadata sidebar (sticky) -->
      <div class="col-span-4 space-y-6">
        <div class="sticky top-8 space-y-6">
          <!-- Metadata -->
          <div class="bg-surface-container-high rounded-xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-lg text-primary">info</span>
              <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Session Metadata</span>
            </div>
            <div class="space-y-3 text-xs">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Active Time</span>
                <span class="font-mono text-primary">{{ formatDuration(session.activeDurationMin) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Wall-clock</span>
                <span class="font-mono text-on-surface-variant">{{ formatDuration(session.durationMin) }}</span>
              </div>
              <div v-if="session.idleSec > 0" class="flex justify-between">
                <span class="text-on-surface-variant">Idle</span>
                <span class="font-mono text-tertiary">{{ formatSec(session.idleSec) }}</span>
              </div>
              <div v-if="session.userPauseCount > 0" class="flex justify-between">
                <span class="text-on-surface-variant">User Pauses</span>
                <span class="font-mono text-on-surface">{{ session.userPauseCount }}</span>
              </div>
              <div v-if="session.userPauseCount > 0" class="flex justify-between">
                <span class="text-on-surface-variant">Longest Pause</span>
                <span class="font-mono text-on-surface">{{ formatSec(session.longestUserPauseSec) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Messages</span>
                <span class="font-mono text-on-surface">{{ session.userMsgCount }}u / {{ session.assistantMsgCount }}a</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Files Touched</span>
                <span class="font-mono text-on-surface">{{ session.filesTouchedCount }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Repo</span>
                <span class="font-mono text-on-surface">{{ session.repoShort }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Branch</span>
                <span class="font-mono text-on-surface truncate ml-4">{{ session.gitBranch }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Created</span>
                <span class="font-mono text-on-surface">{{ formatDate(session.createdAt) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Last Activity</span>
                <span class="font-mono text-on-surface">{{ formatDate(session.lastActivityAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Tool Usage -->
          <div class="bg-surface-container-high rounded-xl p-5" v-if="Object.keys(session.toolCounts || {}).length">
            <ToolUsageChart :toolCounts="session.toolCounts" />
          </div>

          <!-- Correlated PRs -->
          <div class="bg-surface-container-high rounded-xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-lg text-secondary">merge</span>
              <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Correlated PRs</span>
            </div>
            <CorrelationBadge
              v-if="session.correlatedPRs?.length"
              :matches="session.correlatedPRs"
              type="pr"
            />
            <div v-else class="flex items-center gap-2 py-4 text-on-surface-variant">
              <span class="material-symbols-outlined text-lg opacity-40">link_off</span>
              <span class="text-xs">No correlated PRs</span>
            </div>
          </div>

          <!-- Jira IDs -->
          <div class="bg-surface-container-high rounded-xl p-5">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-lg text-tertiary">confirmation_number</span>
              <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Jira Tickets</span>
            </div>
            <div v-if="session.jiraIds?.length" class="flex flex-wrap gap-1.5">
              <router-link
                v-for="id in session.jiraIds"
                :key="id"
                :to="{ name: 'tickets', query: { search: id } }"
                class="text-xs font-mono px-2 py-0.5 rounded-full bg-tertiary-container text-tertiary hover:bg-tertiary/20 transition-colors"
              >
                {{ id }}
              </router-link>
            </div>
            <p v-else class="text-xs text-on-surface-variant">No Jira tickets linked</p>
          </div>

          <!-- Files Touched -->
          <div class="bg-surface-container-high rounded-xl p-5" v-if="session.filesTouchedRelative?.length">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-lg text-primary">folder_open</span>
              <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Files Touched</span>
            </div>
            <div class="space-y-1.5">
              <div v-for="file in visibleFiles" :key="file" class="text-xs font-mono text-on-surface-variant truncate">
                {{ file }}
              </div>
              <button
                v-if="hiddenFileCount > 0 && !showAllFiles"
                @click="showAllFiles = true"
                class="text-xs text-primary hover:underline font-mono"
              >
                and {{ hiddenFileCount }} more...
              </button>
              <button
                v-if="showAllFiles && hiddenFileCount > 0"
                @click="showAllFiles = false"
                class="text-xs text-primary hover:underline font-mono"
              >
                show less
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Not found -->
  <div v-else class="p-8 flex flex-col items-center justify-center min-h-[60vh]">
    <span class="material-symbols-outlined text-4xl text-on-surface-variant opacity-40 mb-3">search_off</span>
    <p class="text-on-surface-variant">Session not found</p>
    <button @click="router.push({ name: 'sessions' })" class="mt-4 text-sm text-primary hover:underline">
      Back to Sessions
    </button>
  </div>
</template>
