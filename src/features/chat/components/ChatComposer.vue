<script setup lang="ts">
defineProps<{
  modelValue: string
  streaming: boolean
  shortcutHint: string
  isDetached: boolean
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
  (event: 'send'): void
  (event: 'keydown', payload: KeyboardEvent & { isComposing?: boolean }): void
}>()
</script>

<template>
  <div class="z-20 flex-shrink-0 border-t border-[var(--border)] bg-[var(--bg)] p-4">
    <div class="relative mx-auto max-w-4xl">
      <div class="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--sidebar)] shadow-lg focus-within:ring-1 focus-within:ring-brand-primary">
        <textarea
          :value="modelValue"
          class="h-16 w-full resize-none bg-transparent p-4 font-mono text-sm outline-none placeholder:opacity-60"
          :placeholder="'Message... (Enter: send, Shift+Enter: newline) | ' + shortcutHint"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          @keydown="emit('keydown', $event as KeyboardEvent & { isComposing?: boolean })"
        ></textarea>
        <div class="flex items-center justify-between border-t border-[var(--border)] bg-black/5 px-3 py-2 dark:bg-black/20">
          <div class="flex space-x-3 text-xs" :style="{ color: 'var(--muted)' }">
            <i class="fa-solid fa-paperclip cursor-pointer opacity-70 hover:opacity-100"></i>
            <span class="hidden opacity-70 sm:inline">
              {{ isDetached ? 'Checkout 상태에서는 커밋 후 브랜치 저장을 권장해요.' : 'Ready' }}
            </span>
          </div>
          <button
            class="px-3 py-1 text-xs font-bold text-brand-primary transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="streaming"
            @click="emit('send')"
          >
            {{ streaming ? 'STREAMING...' : 'SEND' }} <i class="fa-solid fa-paper-plane ml-1"></i>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
