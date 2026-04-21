<script setup lang="ts">
import { ref } from 'vue'
import type { BranchSummary, ChatTimelineRow, CommitNode } from '../types'
import { getForkBranches } from '../utils/forks'
import { shortHash } from '../utils/ids'

const props = defineProps<{
  messages: ChatTimelineRow[]
  highlightedCommitId: string | null
  isDark: boolean
  branchList: BranchSummary[]
  commitByHashMap: Record<string, CommitNode>
  isFutureMessage: (message: ChatTimelineRow) => boolean
}>()

const emit = defineEmits<{
  (event: 'checkout-branch', branchId: string): void
}>()

const forkMenuCommitId = ref<string | null>(null)

const forkBranchesFor = (commitHash: string) => getForkBranches(props.branchList, props.commitByHashMap, commitHash)

const hasFork = (commitHash: string) => forkBranchesFor(commitHash).length > 0

const forkLabel = (commitHash: string) => {
  const count = forkBranchesFor(commitHash).length
  return count > 0 ? `+${count} branches` : ''
}

const forkTooltip = (commitHash: string) => forkBranchesFor(commitHash).map((branch) => branch.name).join(', ')

const toggleForkMenu = (commitHash: string) => {
  forkMenuCommitId.value = forkMenuCommitId.value === commitHash ? null : commitHash
}

const checkoutBranchById = (branchId: string) => {
  forkMenuCommitId.value = null
  emit('checkout-branch', branchId)
}
</script>

<template>
  <div id="chat-box" class="flex-1 space-y-6 overflow-y-auto p-6 scroll-smooth">
    <template v-for="(message, index) in messages" :key="index">
      <div
        v-if="message.type === 'commit'"
        :data-commit-divider="message.hash"
        class="group relative py-4 fade-in transition-all duration-300"
        :class="[
          isFutureMessage(message) ? 'opacity-45' : 'opacity-100',
          highlightedCommitId === message.hash ? 'rounded-xl ring-2 ring-amber-300/70' : '',
        ]"
      >
        <div class="absolute inset-0 flex items-center">
          <div
            class="w-full border-t border-dashed"
            :style="{ borderColor: isDark ? 'rgba(156,163,175,0.35)' : 'rgba(107,114,128,0.35)' }"
          ></div>
        </div>

        <div class="relative flex justify-center">
          <div
            class="flex items-center gap-2 rounded-full border bg-[var(--sidebar)] px-4 py-1.5 font-mono text-[11px] shadow-lg"
            :style="{
              borderColor: 'var(--chipBorder)',
              color: 'var(--muted)',
              boxShadow: '0 10px 25px ' + (isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'),
            }"
          >
            <i class="fa-solid fa-circle-dot text-brand-primary"></i>
            <span v-if="!message.isWorkingTree" class="opacity-70">[{{ shortHash(message.hash) }}]</span>
            <span class="font-sans font-medium" :style="{ color: 'var(--text)' }">{{ message.text }}</span>

            <button
              v-if="!message.isWorkingTree && hasFork(message.hash)"
              class="ml-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-cyan-500/20"
              :title="forkTooltip(message.hash)"
              @click.stop="toggleForkMenu(message.hash)"
            >
              {{ forkLabel(message.hash) }}
            </button>
          </div>

          <div
            v-if="!message.isWorkingTree && forkMenuCommitId === message.hash"
            class="absolute top-8 z-20 min-w-[200px] rounded-lg border bg-[var(--sidebar)] p-2 shadow-xl"
            :style="{ borderColor: 'var(--chipBorder)' }"
          >
            <div class="px-2 pb-1 font-mono text-[10px] opacity-70">Checkout branch</div>
            <button
              v-for="branch in forkBranchesFor(message.hash)"
              :key="branch.id"
              class="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[var(--itemHover)]"
              @click.stop="checkoutBranchById(branch.id)"
            >
              <i class="fa-solid fa-code-branch mr-1.5"></i>{{ branch.name }}
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="message.type === 'merge'" class="relative py-4 fade-in">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-dashed" :style="{ borderColor: isDark ? 'rgba(168,85,247,0.45)' : 'rgba(147,51,234,0.35)' }"></div>
        </div>

        <div class="relative flex justify-center">
          <div
            class="max-w-md rounded-xl border bg-[var(--sidebar)] px-5 py-3 text-xs shadow-lg"
            :style="{
              borderColor: isDark ? 'rgba(168,85,247,0.5)' : 'rgba(147,51,234,0.4)',
              boxShadow: '0 10px 25px ' + (isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)'),
            }"
          >
            <div class="mb-2 flex items-center gap-2">
              <i class="fa-solid fa-code-merge text-purple-400"></i>
              <span class="font-mono text-[10px] opacity-60">[{{ shortHash(message.hash) }}]</span>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-medium"
                :class="message.mergeType === 'DEEP' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'"
              >
                {{ message.mergeType === 'DEEP' ? 'Deep Merge' : 'Squash Merge' }}
              </span>
            </div>
            <div class="mb-1 text-sm font-medium" :style="{ color: 'var(--text)' }">{{ message.text }}</div>
            <div v-if="message.shortSummary" class="text-xs leading-relaxed opacity-70" :style="{ color: 'var(--muted)' }">
              {{ message.shortSummary }}
            </div>
            <button
              v-if="message.longSummary"
              class="mt-2 flex items-center gap-1 text-[10px] text-purple-400 transition-colors hover:text-purple-300"
              @click="message.expanded = !message.expanded"
            >
              <i :class="message.expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" class="text-[8px]"></i>
              {{ message.expanded ? '접기' : '상세 보기' }}
            </button>
            <div
              v-if="message.expanded && message.longSummary"
              class="mt-2 whitespace-pre-wrap border-t pt-2 text-xs leading-relaxed"
              :style="{ borderColor: isDark ? 'rgba(168,85,247,0.25)' : 'rgba(147,51,234,0.15)', color: 'var(--muted)' }"
            >
              {{ message.longSummary }}
            </div>
          </div>
        </div>
      </div>

      <div
        v-else-if="message.type === 'message'"
        class="flex w-full fade-in transition-opacity duration-300"
        :data-msg-commit="message.commitId || undefined"
        :class="[message.role === 'user' ? 'justify-end' : 'justify-start', isFutureMessage(message) ? 'opacity-45' : 'opacity-100']"
      >
        <div
          v-if="message.role === 'ai'"
          class="mr-3 mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white shadow-md"
        >
          <i class="fa-solid fa-robot text-xs"></i>
        </div>
        <div
          class="relative max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm"
          :class="[
            message.role === 'user' ? 'rounded-tr-none bg-brand-primary text-white' : 'rounded-tl-none border border-[var(--border)] bg-[var(--sidebar)]',
            highlightedCommitId && message.commitId === highlightedCommitId ? 'ring-2 ring-amber-300/70' : '',
          ]"
          :style="
            message.role === 'ai'
              ? { color: 'var(--text)', boxShadow: '0 10px 24px ' + (isDark ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.08)') }
              : {}
          "
        >
          <div class="whitespace-pre-wrap">{{ message.text }}</div>
        </div>
      </div>
    </template>
  </div>
</template>
