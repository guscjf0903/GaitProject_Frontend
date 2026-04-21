<script setup lang="ts">
defineProps<{
  currentHead: string
  activeBranch: string
  activeBranchColor: string
  isDetached: boolean
  loadingTimeline: boolean
}>()

const emit = defineEmits<{
  (event: 'go-workspaces'): void
  (event: 'open-merge'): void
  (event: 'open-branch'): void
  (event: 'open-commit'): void
}>()
</script>

<template>
  <div class="z-10 flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-6">
    <div class="flex min-w-0 items-center space-x-3">
      <button
        class="mr-2 flex items-center rounded-md border border-[var(--chipBorder)] bg-[var(--sidebar)] px-2 py-1 text-[11px] transition-colors hover:bg-[var(--itemHover)]"
        title="워크스페이스 목록으로"
        @click="emit('go-workspaces')"
      >
        <i class="fa-solid fa-arrow-left mr-1"></i> Workspaces
      </button>

      <span class="text-sm" :style="{ color: 'var(--muted)' }">HEAD:</span>
      <div class="flex items-center rounded-full border border-[var(--chipBorder)] bg-[var(--chip)] px-3 py-1 font-mono text-xs font-medium">
        <i class="fa-solid fa-code-commit mr-2 text-brand-primary"></i>
        <span class="max-w-[180px] truncate">{{ currentHead }}</span>
      </div>
      <span class="hidden sm:inline" :style="{ color: 'var(--muted)' }">on</span>
      <span class="text-xs font-bold" :style="{ color: activeBranchColor }">{{ activeBranch }}</span>

      <span
        v-if="isDetached"
        class="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-600 dark:text-amber-300"
      >
        DETACHED
      </span>

      <span
        v-if="loadingTimeline"
        class="ml-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] text-sky-600 dark:text-sky-300"
      >
        LOADING...
      </span>
    </div>

    <div class="flex space-x-2">
      <button
        class="rounded border border-[var(--chipBorder)] px-3 py-1.5 text-xs font-medium text-blue-500 transition-colors hover:bg-[var(--itemHover)]"
        @click="emit('open-merge')"
      >
        <i class="fa-solid fa-code-merge mr-1.5"></i> Merge
      </button>
      <button
        class="rounded border border-[var(--chipBorder)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--itemHover)]"
        @click="emit('open-branch')"
      >
        <i class="fa-solid fa-code-branch mr-1.5"></i> New Branch
      </button>
      <button
        class="rounded bg-brand-primary px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-purple-600"
        @click="emit('open-commit')"
      >
        <i class="fa-solid fa-floppy-disk mr-1.5"></i> Commit
      </button>
    </div>
  </div>
</template>
