<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  text: { type: String, default: '' },
})

const visible = ref(false)
const coords = ref({ top: 0, left: 0 })
const tipEl = ref(null)

let cachedRect = null
let rafId = null

async function show(e) {
  if (!props.text) return
  visible.value = true
  const { clientX, clientY } = e
  await nextTick()
  cachedRect = tipEl.value?.getBoundingClientRect() ?? null
  position(clientX, clientY)
}

function move(e) {
  if (!visible.value || rafId) return
  const { clientX, clientY } = e
  rafId = requestAnimationFrame(() => {
    rafId = null
    position(clientX, clientY)
  })
}

function hide() {
  visible.value = false
  cachedRect = null
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
}

function position(clientX, clientY) {
  if (!cachedRect) return
  const margin = 8
  let left = clientX - cachedRect.width / 2
  let top = clientY - cachedRect.height - 12
  if (left < margin) left = margin
  if (left + cachedRect.width + margin > window.innerWidth) {
    left = window.innerWidth - cachedRect.width - margin
  }
  if (top < margin) top = clientY + 16
  coords.value = { top, left }
}
</script>

<template>
  <span
    class="contents"
    @mouseenter="show"
    @mousemove="move"
    @mouseleave="hide"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="tipEl"
      class="fixed z-[9999] pointer-events-none px-2 py-1 rounded-lg text-xs font-mono bg-surface-container text-on-surface border border-outline-variant shadow-lg max-w-xs"
      :style="{ top: coords.top + 'px', left: coords.left + 'px' }"
    >
      {{ text }}
    </div>
  </Teleport>
</template>
