<script setup>
defineProps({
  icon: { type: String, default: 'inbox' },
  message: { type: String, default: 'No data available' },
})
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-on-surface-variant">
    <span class="material-symbols-outlined text-4xl mb-3 opacity-40">{{ icon }}</span>
    <p class="text-sm">{{ message }}</p>
  </div>
</template>
