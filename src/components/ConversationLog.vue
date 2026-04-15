<script setup>
import { computed } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const md = new Marked({ gfm: true, breaks: true })

const props = defineProps({
  userMessages: Array,
  assistantTexts: Array,
})

function dateKey(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDayLabel(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const groupedMessages = computed(() => {
  const user = (props.userMessages || []).map(m => ({ ...m, role: 'user' }))
  const assistant = (props.assistantTexts || []).map(m => ({ ...m, role: 'assistant' }))
  const sorted = [...user, ...assistant]
    .map(m => {
      const d = m.ts ? new Date(m.ts) : null
      return {
        ...m,
        html: DOMPurify.sanitize(md.parse(m.text || '')),
        time: d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
        date: dateKey(m.ts),
        _t: d ? d.getTime() : 0,
      }
    })
    .sort((a, b) => a._t - b._t)

  const groups = []
  let currentDate = null
  for (const m of sorted) {
    if (m.date !== currentDate) {
      currentDate = m.date
      groups.push({ type: 'date', label: formatDayLabel(m.ts), key: m.date })
    }
    groups.push({ type: 'message', ...m })
  }
  return groups
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-lg text-primary">chat</span>
        <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">Conversation Log</span>
      </div>
      <span class="text-xs text-on-surface-variant font-mono">
        {{ (userMessages?.length || 0) + (assistantTexts?.length || 0) }} messages
      </span>
    </div>

    <p v-if="userMessages?.length === 0 && assistantTexts?.length === 0" class="text-sm text-on-surface-variant italic py-8 text-center">
      No conversation data available
    </p>

    <template v-for="(item, i) in groupedMessages" :key="item.key || item.ts || i">
      <!-- Date separator -->
      <div v-if="item.type === 'date'" class="flex items-center gap-3 py-2">
        <div class="flex-1 h-px bg-outline-variant/30" />
        <span class="text-xs font-mono font-semibold tracking-wider text-on-surface-variant">{{ item.label }}</span>
        <div class="flex-1 h-px bg-outline-variant/30" />
      </div>

      <!-- User message -->
      <div v-else-if="item.role === 'user'" class="border-l-2 border-primary/40 pl-4 py-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="material-symbols-outlined text-sm text-primary">person</span>
          <span class="text-[0.625rem] font-mono uppercase tracking-wider text-on-surface-variant">User</span>
          <span class="text-xs font-mono font-medium text-on-surface-variant ml-auto">{{ item.time }}</span>
        </div>
        <div class="markdown-body text-sm" v-html="item.html" />
      </div>

      <!-- Assistant message -->
      <div v-else class="bg-surface-container-high rounded-lg px-4 py-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="material-symbols-outlined text-sm text-secondary">smart_toy</span>
          <span class="text-[0.625rem] font-mono uppercase tracking-wider text-on-surface-variant">Assistant</span>
          <span class="text-xs font-mono font-medium text-on-surface-variant ml-auto">{{ item.time }}</span>
        </div>
        <div class="markdown-body text-sm" v-html="item.html" />
      </div>
    </template>
  </div>
</template>
