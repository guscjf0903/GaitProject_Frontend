import { computed, onBeforeUnmount, reactive, ref, type MaybeRefOrGetter, toValue } from 'vue'
import type { MessageResponse } from '../../../api/generated'
import type { ChatTimelineRow, CommitNode } from '../types'
import { buildTimelineRows } from '../utils/timeline'

type ChatTimelineStateOptions = {
  commits: MaybeRefOrGetter<CommitNode[]>
  commitByHashMap: MaybeRefOrGetter<Record<string, CommitNode>>
  currentHead: MaybeRefOrGetter<string>
  serverHeadCommitId: MaybeRefOrGetter<string | null>
  branchOrderMap: MaybeRefOrGetter<Record<string, number>>
  selectedOrder: MaybeRefOrGetter<number>
  headOrder: MaybeRefOrGetter<number>
}

const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function useChatTimelineState(options: ChatTimelineStateOptions) {
  const commits = computed(() => toValue(options.commits))
  const commitByHashMap = computed(() => toValue(options.commitByHashMap))
  const currentHead = computed(() => toValue(options.currentHead))
  const serverHeadCommitId = computed(() => toValue(options.serverHeadCommitId))
  const branchOrderMap = computed(() => toValue(options.branchOrderMap))
  const selectedOrder = computed(() => toValue(options.selectedOrder))
  const headOrder = computed(() => toValue(options.headOrder))

  const messages = ref<ChatTimelineRow[]>([
    { type: 'message', role: 'ai', text: 'Ready to work on [main].', model: 'System' },
  ])
  const snapshots = reactive<Record<string, ChatTimelineRow[]>>({})
  const highlightedCommitId = ref<string | null>(null)
  const latestLoadedBranchId = ref<string | null>(null)

  let highlightTimer: ReturnType<typeof setTimeout> | null = null

  function replaceMessages(next: ChatTimelineRow[]) {
    messages.value = next
  }

  function setTimelineFromRaw(committedRaw: MessageResponse[], pendingRaw: MessageResponse[]) {
    replaceMessages(buildTimelineRows(committedRaw, pendingRaw, currentHead.value, commitByHashMap.value))
  }

  function saveCurrentHeadSnapshot() {
    if (!currentHead.value) return
    snapshots[currentHead.value] = deepCopy(messages.value)
  }

  function cloneRows(rows: ChatTimelineRow[]) {
    return deepCopy(rows)
  }

  function scrollToBottom(id: string) {
    requestAnimationFrame(() => {
      const element = document.getElementById(id)
      if (element) {
        element.scrollTop = element.scrollHeight
      }
    })
  }

  function scrollToCommitInSidebar(hash: string) {
    requestAnimationFrame(() => {
      const container = document.getElementById('graph-container')
      const row = container?.querySelector(`[data-hash="${hash}"]`) as HTMLElement | null
      if (container && row) {
        const top = row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2
        container.scrollTo({ top: Math.max(top, 0), behavior: 'smooth' })
      }
    })
  }

  function focusCommitInChat(commitHash: string) {
    requestAnimationFrame(() => {
      const divider = document.querySelector(`[data-commit-divider="${commitHash}"]`) as HTMLElement | null
      const fallback = document.querySelector(`[data-msg-commit="${commitHash}"]`) as HTMLElement | null
      const target = divider ?? fallback

      if (!target) return

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      highlightedCommitId.value = commitHash
      if (highlightTimer) clearTimeout(highlightTimer)
      highlightTimer = setTimeout(() => {
        highlightedCommitId.value = null
      }, 1400)
    })
  }

  function isFutureMessage(message: ChatTimelineRow) {
    if (!serverHeadCommitId.value || selectedOrder.value >= headOrder.value) return false

    if (message.type === 'commit' || message.type === 'merge') {
      if (message.type === 'commit' && message.isWorkingTree) return true
      const index = branchOrderMap.value[message.hash]
      return typeof index === 'number' ? index > selectedOrder.value : false
    }

    if (message.type === 'message' && message.commitId) {
      const index = branchOrderMap.value[message.commitId]
      return typeof index === 'number' ? index > selectedOrder.value : false
    }

    return true
  }

  onBeforeUnmount(() => {
    if (highlightTimer) {
      clearTimeout(highlightTimer)
      highlightTimer = null
    }
  })

  return {
    commits,
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
  }
}
