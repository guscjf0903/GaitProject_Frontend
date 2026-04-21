<script setup lang="ts">
import { computed } from 'vue'
import type { GraphNode, GraphPath, CommitNode } from '../types'
import { getBranchColor } from '../utils/branch'

const props = defineProps<{
  width: number
  commits: CommitNode[]
  currentHead: string
  selectedLineageSet: Set<string>
  graphNodes: GraphNode[]
  graphPaths: GraphPath[]
  containerHeight: number
  graphPaneRenderWidth: number
  planLabel: string
  usageLabel: string
  isDark: boolean
}>()

const emit = defineEmits<{
  (event: 'toggle-sidebar'): void
  (event: 'toggle-theme'): void
  (event: 'logout'): void
  (event: 'checkout-commit', hash: string): void
  (event: 'start-sidebar-resize', mouseEvent: MouseEvent): void
  (event: 'start-graph-pane-resize', mouseEvent: MouseEvent): void
}>()

const commitsCount = computed(() => props.commits.length)
</script>

<template>
  <div class="flex h-full flex-shrink-0" :style="{ width: `${width}px` }">
    <aside class="z-20 flex h-full w-full flex-col border-r border-[var(--border)] bg-[var(--sidebar)]">
      <div class="flex h-14 flex-shrink-0 items-center justify-between border-b border-[var(--border)] px-4">
        <div class="flex min-w-0 items-center font-semibold">
          <i class="fa-solid fa-code-branch mr-2 text-brand-primary"></i>
          <span class="truncate">gait-project</span>
        </div>
        <div class="flex items-center gap-2">
          <div class="rounded bg-brand-primary/15 px-2 py-0.5 font-mono text-[10px] text-brand-secondary">
            {{ commitsCount }} Commits
          </div>
          <button
            class="h-6 w-6 rounded border border-[var(--chipBorder)] text-[11px] hover:bg-[var(--itemHover)]"
            title="사이드바 닫기"
            @click="emit('toggle-sidebar')"
          >
            <i class="fa-solid fa-angle-left"></i>
          </button>
        </div>
      </div>

      <div id="graph-container" class="relative flex flex-1 overflow-x-hidden overflow-y-auto">
        <div class="relative h-full flex-shrink-0 border-r border-[var(--border)]/40" :style="{ width: `${graphPaneRenderWidth}px` }">
          <svg class="absolute left-0 top-0 w-full" :style="{ height: Math.max(containerHeight, 600) + 'px' }">
            <path
              v-for="(path, index) in graphPaths"
              :key="'path-' + index"
              :d="path.d"
              fill="none"
              :stroke="path.color"
              :stroke-width="path.isMergeEdge ? 1.5 : path.isActive ? 3.2 : 1.8"
              :opacity="path.isMergeEdge ? 0.45 : path.isActive ? 1 : 0.25"
              :stroke-dasharray="path.isMergeEdge ? '6 4' : 'none'"
              class="graph-path"
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <circle
              v-for="node in graphNodes"
              :key="'halo-' + node.hash"
              :cx="node.x"
              :cy="node.y"
              r="12"
              class="cursor-pointer"
              fill="transparent"
              @click="emit('checkout-commit', node.hash)"
            />

            <circle
              v-for="node in graphNodes.filter((item) => !item.isMerge)"
              :key="'node-' + node.hash"
              :cx="node.x"
              :cy="node.y"
              :r="currentHead === node.hash ? 5.8 : 4.5"
              :fill="currentHead === node.hash ? '#FFFFFF' : 'var(--sidebar)'"
              :stroke="node.color"
              :stroke-width="currentHead === node.hash ? 3.6 : 2.5"
              :opacity="node.isActive || currentHead === node.hash ? 1 : 0.35"
              class="node-pop"
              pointer-events="none"
            />

            <rect
              v-for="node in graphNodes.filter((item) => item.isMerge)"
              :key="'merge-node-' + node.hash"
              :x="node.x - 4.5"
              :y="node.y - 4.5"
              width="9"
              height="9"
              :transform="`rotate(45 ${node.x} ${node.y})`"
              :fill="currentHead === node.hash ? '#FFFFFF' : 'var(--sidebar)'"
              :stroke="node.color"
              :stroke-width="currentHead === node.hash ? 3.2 : 2.2"
              :opacity="node.isActive || currentHead === node.hash ? 1 : 0.35"
              class="node-pop"
              pointer-events="none"
            />
          </svg>
        </div>

        <div
          class="h-full w-1 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-brand-primary/20 active:bg-brand-primary/30"
          @mousedown.prevent="emit('start-graph-pane-resize', $event)"
        ></div>

        <div class="min-w-[160px] flex-1 pb-10 pt-4">
          <div
            v-for="commit in commits"
            :key="commit.hash"
            :data-hash="commit.hash"
            class="group relative flex h-[60px] cursor-pointer flex-col justify-center border-l-2 px-3 transition-colors"
            :class="[
              currentHead === commit.hash ? 'border-brand-primary bg-black/5 dark:bg-white/5' : 'border-transparent hover:bg-[var(--itemHover)]',
              selectedLineageSet.has(commit.hash) ? '' : 'opacity-50',
            ]"
            @click="emit('checkout-commit', commit.hash)"
          >
            <div class="mb-0.5 flex items-center justify-between">
              <span
                class="truncate pr-2 text-xs font-medium"
                :style="{ color: currentHead === commit.hash ? 'var(--text)' : 'var(--muted)' }"
              >
                {{ commit.msg }}
              </span>
            </div>

            <div class="flex items-center font-mono text-[10px]" :style="{ color: 'var(--muted)' }">
              <span class="mr-2 font-semibold" :style="{ color: getBranchColor(commit.branch) }">{{ commit.branch }}</span>
              <span class="mr-2 opacity-70">{{ commit.hash }}</span>
              <span class="ml-auto opacity-70">{{ commit.time }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-shrink-0 border-t border-[var(--border)] bg-[var(--sidebar)] p-3">
        <div class="flex items-center rounded-lg border border-[var(--chipBorder)] bg-[var(--chip)] p-2">
          <div class="flex h-8 w-8 items-center justify-center rounded bg-gradient-to-br from-indigo-600 to-purple-600 text-xs font-bold text-white">
            ME
          </div>
          <div class="ml-2.5 min-w-0 flex-1">
            <div class="text-xs font-bold">{{ planLabel }}</div>
            <div class="text-[10px]" :style="{ color: 'var(--muted)' }">{{ usageLabel }}</div>
          </div>
          <button
            class="ml-1 rounded-md border border-[var(--chipBorder)] px-2.5 py-1.5 text-xs text-red-500 transition hover:bg-red-500/10"
            title="로그아웃"
            @click="emit('logout')"
          >
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
          <button
            class="ml-1 rounded-md border border-[var(--chipBorder)] px-2.5 py-1.5 text-xs transition hover:bg-[var(--itemHover)]"
            title="테마 변경"
            @click="emit('toggle-theme')"
          >
            <i class="fa-solid" :class="isDark ? 'fa-sun' : 'fa-moon'"></i>
          </button>
        </div>
      </div>
    </aside>

    <div
      class="h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-brand-primary/20 active:bg-brand-primary/30"
      @mousedown.prevent="emit('start-sidebar-resize', $event)"
    ></div>
  </div>
</template>
