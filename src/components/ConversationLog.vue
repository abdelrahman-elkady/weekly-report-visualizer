<script setup>
import { computed } from 'vue'
import { Marked } from 'marked'
import DOMPurify from 'dompurify'

const md = new Marked({ gfm: true, breaks: true })

const props = defineProps({
  userMessages: Array,
  assistantTexts: Array,
})

const messages = computed(() => {
  const user = (props.userMessages || []).map(m => ({ ...m, role: 'user' }))
  const assistant = (props.assistantTexts || []).map(m => ({ ...m, role: 'assistant' }))
  return [...user, ...assistant]
    .sort((a, b) => new Date(a.ts) - new Date(b.ts))
    .map(m => ({
      ...m,
      html: DOMPurify.sanitize(md.parse(m.text || '')),
      time: m.ts ? new Date(m.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
    }))
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

    <div v-for="(msg, i) in messages" :key="i" class="group">
      <!-- User message -->
      <div v-if="msg.role === 'user'" class="border-l-2 border-primary/40 pl-4 py-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="material-symbols-outlined text-sm text-primary">person</span>
          <span class="text-[0.625rem] font-mono uppercase tracking-wider text-on-surface-variant">User</span>
          <span class="text-[0.625rem] font-mono text-outline ml-auto">{{ msg.time }}</span>
        </div>
        <div class="markdown-body text-sm" v-html="msg.html" />
      </div>

      <!-- Assistant message -->
      <div v-else class="bg-surface-container-high rounded-lg px-4 py-3">
        <div class="flex items-center gap-2 mb-2">
          <span class="material-symbols-outlined text-sm text-secondary">smart_toy</span>
          <span class="text-[0.625rem] font-mono uppercase tracking-wider text-on-surface-variant">Assistant</span>
          <span class="text-[0.625rem] font-mono text-outline ml-auto">{{ msg.time }}</span>
        </div>
        <div class="markdown-body text-sm" v-html="msg.html" />
      </div>
    </div>
  </div>
</template>
