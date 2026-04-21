<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message: string
}>()
</script>

<template>
  <div v-if="show" class="absolute bottom-6 right-6 z-30">
    <div class="rounded-xl border bg-[var(--sidebar)] px-4 py-2 shadow-lg fade-in" :style="{ borderColor: 'var(--chipBorder)', color: 'var(--text)' }">
      <div class="font-mono text-xs" :style="{ color: 'var(--muted)' }">{{ title }}</div>
      <div class="text-sm font-medium">{{ message }}</div>
    </div>
  </div>
</template>
