<script setup lang="ts">
defineProps<{
  open: boolean
  message: string
  loading: boolean
  shortcutLabel: string
}>()

const emit = defineEmits<{
  (event: 'update:message', value: string): void
  (event: 'confirm'): void
  (event: 'close'): void
}>()
</script>

<template>
  <div v-if="open" class="absolute inset-0 z-40 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div class="relative w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] p-5 shadow-2xl" :style="{ borderColor: 'var(--border)' }">
      <div class="mb-4 flex items-center justify-between">
        <div class="font-semibold">Commit changes</div>
        <button class="text-sm opacity-70 hover:opacity-100" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <label class="text-xs" :style="{ color: 'var(--muted)' }">Commit message</label>
      <input
        :value="message"
        class="mt-2 w-full rounded-xl border bg-transparent px-3 py-2 font-sans outline-none focus:ring-1 focus:ring-brand-primary"
        :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
        placeholder="e.g. Fix null pointer in SearchDataHandler"
        @input="emit('update:message', ($event.target as HTMLInputElement).value)"
        @keydown.enter.prevent="emit('confirm')"
      />

      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded-lg border px-3 py-2 text-xs hover:bg-[var(--itemHover)]" :style="{ borderColor: 'var(--border)' }" @click="emit('close')">
          Cancel
        </button>
        <button
          class="rounded-lg bg-brand-primary px-3 py-2 text-xs text-white hover:bg-purple-600 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="loading"
          @click="emit('confirm')"
        >
          <i class="fa-solid fa-floppy-disk mr-1.5"></i> {{ loading ? 'Committing...' : 'Commit' }}
        </button>
      </div>

      <div class="mt-3 font-mono text-[11px]" :style="{ color: 'var(--muted)' }">Shortcut: {{ shortcutLabel }}</div>
    </div>
  </div>
</template>
