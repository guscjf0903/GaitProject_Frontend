<script setup lang="ts">
import type { BranchSummary } from '../types'

defineProps<{
  open: boolean
  branches: BranchSummary[]
  fromBranchId: string
  toBranchId: string
  mergeType: 'SQUASH' | 'DEEP'
  notes: string
  loading: boolean
}>()

const emit = defineEmits<{
  (event: 'update:fromBranchId', value: string): void
  (event: 'update:toBranchId', value: string): void
  (event: 'update:mergeType', value: 'SQUASH' | 'DEEP'): void
  (event: 'update:notes', value: string): void
  (event: 'confirm'): void
  (event: 'close'): void
}>()
</script>

<template>
  <div v-if="open" class="absolute inset-0 z-40 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <div class="relative w-[520px] max-w-[92vw] rounded-2xl border bg-[var(--sidebar)] p-5 shadow-2xl" :style="{ borderColor: 'var(--border)' }">
      <div class="mb-4 flex items-center justify-between">
        <div class="font-semibold"><i class="fa-solid fa-code-merge mr-2 text-blue-500"></i>Merge Branch</div>
        <button class="text-sm opacity-70 hover:opacity-100" @click="emit('close')"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="text-xs" :style="{ color: 'var(--muted)' }">Source Branch (from)</label>
          <select
            :value="fromBranchId"
            class="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @change="emit('update:fromBranchId', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="branch in branches" :key="branch.id" :value="branch.id" class="bg-[var(--bg)]">{{ branch.name }}</option>
          </select>
        </div>

        <div class="flex justify-center text-xl text-blue-500"><i class="fa-solid fa-arrow-down"></i></div>

        <div>
          <label class="text-xs" :style="{ color: 'var(--muted)' }">Target Branch (to)</label>
          <select
            :value="toBranchId"
            class="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @change="emit('update:toBranchId', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="branch in branches" :key="branch.id" :value="branch.id" class="bg-[var(--bg)]">{{ branch.name }}</option>
          </select>
        </div>

        <div>
          <label class="text-xs" :style="{ color: 'var(--muted)' }">Merge Type</label>
          <select
            :value="mergeType"
            class="mt-1 w-full rounded-xl border bg-transparent px-3 py-2 outline-none focus:ring-1 focus:ring-brand-primary"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            @change="emit('update:mergeType', ($event.target as HTMLSelectElement).value as 'SQUASH' | 'DEEP')"
          >
            <option value="SQUASH" class="bg-[var(--bg)]">Squash Merge (저비용 AI 요약 통합)</option>
            <option value="DEEP" class="bg-[var(--bg)]">Deep Merge (고비용 AI 지능형 통합 - Master 전용)</option>
          </select>
          <p v-if="mergeType === 'SQUASH'" class="mt-1.5 text-[10px] leading-relaxed opacity-60" :style="{ color: 'var(--muted)' }">
            AI가 두 브랜치의 요약을 저비용으로 통합합니다. 주요 내용의 간략한 정리가 생성됩니다.
          </p>
          <p v-if="mergeType === 'DEEP'" class="mt-1.5 text-[10px] leading-relaxed opacity-60" :style="{ color: 'var(--muted)' }">
            AI가 원본 대화까지 포함해 겹침, 보강, 충돌을 더 자세히 통합합니다.
          </p>
        </div>

        <div>
          <label class="text-xs" :style="{ color: 'var(--muted)' }">AI 지시사항 (선택)</label>
          <textarea
            :value="notes"
            rows="2"
            class="mt-1 w-full resize-none rounded-xl border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-brand-primary"
            :style="{ borderColor: 'var(--border)', color: 'var(--text)' }"
            placeholder="예: A 브랜치 설계를 중심으로 B 브랜치를 통합해줘"
            @input="emit('update:notes', ($event.target as HTMLTextAreaElement).value)"
          ></textarea>
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button class="rounded-lg border px-3 py-2 text-xs hover:bg-[var(--itemHover)]" :style="{ borderColor: 'var(--border)' }" @click="emit('close')">
          Cancel
        </button>
        <button class="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white transition hover:bg-blue-700" :disabled="loading" @click="emit('confirm')">
          <i v-if="loading" class="fa-solid fa-spinner mr-1.5 fa-spin"></i>
          {{ loading ? 'Merging...' : 'Merge' }}
        </button>
      </div>
    </div>
  </div>
</template>
