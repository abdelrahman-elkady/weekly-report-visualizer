<script setup>
defineProps({
  icon: String,
  label: String,
  value: [String, Number],
  unit: { type: String, default: '' },
  color: { type: String, default: 'primary' },
  clickable: { type: Boolean, default: false },
})

const emit = defineEmits(['click'])
</script>

<template>
  <div
    class="bg-surface-container-high rounded-xl p-5 transition-all duration-200"
    :class="clickable ? 'cursor-pointer hover:scale-[1.02] hover:bg-surface-container-highest/80' : ''"
    @click="clickable && emit('click')"
  >
    <div class="flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-lg" :class="`text-${color}`">{{ icon }}</span>
      <span class="text-[0.6875rem] font-mono uppercase tracking-wider text-on-surface-variant">{{ label }}</span>
    </div>
    <div class="flex items-baseline gap-1.5">
      <span class="text-3xl font-mono font-bold text-on-surface">{{ value }}</span>
      <span v-if="unit" class="text-xs text-on-surface-variant font-mono">{{ unit }}</span>
    </div>
    <slot />
  </div>
</template>
