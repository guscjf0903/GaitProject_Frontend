<script setup lang="ts">
import { computed, onMounted, ref, toRefs, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useProfileStore } from '../stores/profile'
import type { BranchSummary, CommitNode } from '../features/chat/types'
import { getBranchColor } from '../features/chat/utils/branch'
import { useChatUiState } from '../features/chat/composables/useChatUiState'
import { useChatGraphState } from '../features/chat/composables/useChatGraphState'
import { useChatTimelineState } from '../features/chat/composables/useChatTimelineState'
import { useChatStreamActions } from '../features/chat/composables/useChatStreamActions'
import { useChatBootstrap } from '../features/chat/composables/useChatBootstrap'
import { useChatMutations } from '../features/chat/composables/useChatMutations'
import GitGraphSidebar from '../features/chat/components/GitGraphSidebar.vue'
import ChatTopbar from '../features/chat/components/ChatTopbar.vue'
import ChatTimeline from '../features/chat/components/ChatTimeline.vue'
import ChatComposer from '../features/chat/components/ChatComposer.vue'
import CommitModal from '../features/chat/components/CommitModal.vue'
import BranchModal from '../features/chat/components/BranchModal.vue'
import MergeModal from '../features/chat/components/MergeModal.vue'
import ToastNotice from '../features/chat/components/ToastNotice.vue'

const props = defineProps<{ workspaceId: string; branchId: string }>()

const { workspaceId, branchId } = toRefs(props)
const router = useRouter()
const auth = useAuthStore()
const profile = useProfileStore()

const activeBranch = ref('main')
const currentHead = ref('')
const serverHeadCommitId = ref<string | null>(null)
const branchList = ref<BranchSummary[]>([])
const commits = ref<CommitNode[]>([])
const pendingCheckoutCommitId = ref<string | null>(null)

const ui = useChatUiState()
const {
  isDark,
  sidebarWidth,
  sidebarCollapsed,
  graphPaneWidth,
  toast,
  commitModal,
  branchModal,
  mergeModal,
  shortcutHint,
  shortcutCommit,
  shortcutBranch,
  toggleTheme,
  toggleSidebar,
  toastNow,
  startSidebarResize,
  startGraphPaneResize,
  openCommitModal: openCommitModalDialog,
  closeCommitModal,
  openBranchModal: openBranchModalDialog,
  closeBranchModal,
  openMergeModal: openMergeModalDialog,
  closeMergeModal,
} = ui

const graph = useChatGraphState({
  commits,
  branchList,
  currentHead,
  serverHeadCommitId,
  sidebarWidth,
  graphPaneWidth,
})
const {
  commitByHashMap,
  selectedLineageSet,
  branchOrderMap,
  currentBranchHeadLineageSet,
  selectedOrder,
  headOrder,
  graphNodes,
  graphPaths,
  containerHeight,
  graphPaneRenderWidth,
  isDetached,
} = graph

const timeline = useChatTimelineState({
  commits,
  commitByHashMap,
  currentHead,
  serverHeadCommitId,
  branchOrderMap,
  selectedOrder,
  headOrder,
})
const {
  messages,
  snapshots,
  highlightedCommitId,
  latestLoadedBranchId,
  replaceMessages,
  setTimelineFromRaw,
  saveCurrentHeadSnapshot,
  cloneRows,
  scrollToBottom,
  scrollToCommitInSidebar,
  focusCommitInChat,
  isFutureMessage,
} = timeline

let bootstrap!: ReturnType<typeof useChatBootstrap>

const stream = useChatStreamActions({
  workspaceId,
  branchId,
  currentHead,
  isDetached,
  messages,
  saveCurrentHeadSnapshot,
  scrollToBottom,
  refreshCurrentBranchCommits: (targetBranchId?: string) => bootstrap.refreshCurrentBranchCommits(targetBranchId),
  toastNow,
  openCommitModal: () => openCommitModalDialog(activeBranch.value),
  openBranchModal: openBranchModalDialog,
})
const { input, streaming, send, onInputKeydown } = stream

bootstrap = useChatBootstrap({
  workspaceId,
  branchId,
  activeBranch,
  currentHead,
  serverHeadCommitId,
  branchList,
  commits,
  pendingCheckoutCommitId,
  streaming,
  currentBranchHeadLineageSet,
  commitByHashMap,
  latestLoadedBranchId,
  snapshots,
  messages,
  replaceMessages,
  setTimelineFromRaw,
  saveCurrentHeadSnapshot,
  cloneRows,
  focusCommitInChat,
  scrollToBottom,
  scrollToCommitInSidebar,
  toastNow,
  router,
})
const {
  loadingTimeline,
  loadMessagesLatest,
  checkoutByHash,
  bootstrapFromServer,
} = bootstrap

const mutations = useChatMutations({
  workspaceId,
  branchId,
  userId: computed(() => auth.userId ?? null),
  router,
  branchList,
  commits,
  messages,
  snapshots,
  activeBranch,
  currentHead,
  serverHeadCommitId,
  isDetached,
  toastNow,
  saveCurrentHeadSnapshot,
  focusCommitInChat,
  scrollToBottom,
  scrollToCommitInSidebar,
  loadMessagesLatest,
  cloneRows,
  commitModal,
  branchModal,
  mergeModal,
})
const { committing, merging, confirmCommit, confirmBranch, confirmMerge } = mutations

const planLabel = computed(() => profile.planLabel)
const usageLabel = computed(() => profile.usageLabel)
const activeBranchColor = computed(() => getBranchColor(activeBranch.value))

const goWorkspaces = async () => {
  await router.push('/')
}

const logout = async () => {
  auth.clear()
  profile.reset()
  await router.push('/login')
}

const checkoutBranchById = async (targetBranchId: string) => {
  await router.push(`/w/${workspaceId.value}/b/${targetBranchId}`)
}

const openCommitModalForCurrentBranch = () => {
  openCommitModalDialog(activeBranch.value)
}

const openMergeModalForCurrentBranch = () => {
  openMergeModalDialog(branchId.value)
}

const updateInput = (value: string) => {
  input.value = value
}

watch(
  () => [workspaceId.value, branchId.value],
  () => {
    void bootstrapFromServer()
  },
  { immediate: true },
)

onMounted(() => {
  if (auth.isAuthed) {
    void profile.fetchProfile()
  }
})
</script>

<template>
  <div class="flex h-full w-full">
    <GitGraphSidebar
      v-if="!sidebarCollapsed"
      :width="sidebarWidth"
      :commits="commits"
      :current-head="currentHead"
      :selected-lineage-set="selectedLineageSet"
      :graph-nodes="graphNodes"
      :graph-paths="graphPaths"
      :container-height="containerHeight"
      :graph-pane-render-width="graphPaneRenderWidth"
      :plan-label="planLabel"
      :usage-label="usageLabel"
      :is-dark="isDark"
      @toggle-sidebar="toggleSidebar"
      @toggle-theme="toggleTheme"
      @logout="logout"
      @checkout-commit="checkoutByHash"
      @start-sidebar-resize="startSidebarResize"
      @start-graph-pane-resize="startGraphPaneResize"
    />

    <main class="relative flex min-w-0 flex-1 flex-col bg-[var(--bg)]">
      <button
        v-if="sidebarCollapsed"
        class="absolute left-2 top-2 z-30 rounded-md border border-[var(--chipBorder)] bg-[var(--sidebar)] px-2.5 py-1.5 text-xs hover:bg-[var(--itemHover)]"
        @click="toggleSidebar"
      >
        <i class="fa-solid fa-code-branch mr-1.5"></i> Graph
      </button>

      <ChatTopbar
        :current-head="currentHead"
        :active-branch="activeBranch"
        :active-branch-color="activeBranchColor"
        :is-detached="isDetached"
        :loading-timeline="loadingTimeline"
        @go-workspaces="goWorkspaces"
        @open-merge="openMergeModalForCurrentBranch"
        @open-branch="openBranchModalDialog"
        @open-commit="openCommitModalForCurrentBranch"
      />

      <ChatTimeline
        :messages="messages"
        :highlighted-commit-id="highlightedCommitId"
        :is-dark="isDark"
        :branch-list="branchList"
        :commit-by-hash-map="commitByHashMap"
        :is-future-message="isFutureMessage"
        @checkout-branch="checkoutBranchById"
      />

      <ChatComposer
        :model-value="input"
        :streaming="streaming"
        :shortcut-hint="shortcutHint"
        :is-detached="isDetached"
        @update:model-value="updateInput"
        @send="send"
        @keydown="onInputKeydown"
      />

      <ToastNotice :show="toast.show" :title="toast.title" :message="toast.message" />

      <CommitModal
        :open="commitModal.open"
        :message="commitModal.message"
        :loading="committing"
        :shortcut-label="shortcutCommit"
        @update:message="commitModal.message = $event"
        @confirm="confirmCommit"
        @close="closeCommitModal"
      />

      <BranchModal
        :open="branchModal.open"
        :name="branchModal.name"
        :shortcut-label="shortcutBranch"
        @update:name="branchModal.name = $event"
        @confirm="confirmBranch"
        @close="closeBranchModal"
      />

      <MergeModal
        :open="mergeModal.open"
        :branches="branchList"
        :from-branch-id="mergeModal.fromBranchId"
        :to-branch-id="mergeModal.toBranchId"
        :merge-type="mergeModal.mergeType"
        :notes="mergeModal.notes"
        :loading="merging"
        @update:from-branch-id="mergeModal.fromBranchId = $event"
        @update:to-branch-id="mergeModal.toBranchId = $event"
        @update:merge-type="mergeModal.mergeType = $event"
        @update:notes="mergeModal.notes = $event"
        @confirm="confirmMerge"
        @close="closeMergeModal"
      />
    </main>
  </div>
</template>
