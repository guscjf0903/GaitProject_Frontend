import { ref, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import { createBranch, createCommit, createMerge, extractApiErrorMessage, listTimelineAfter } from '../../../api/clients'
import { isUuid } from '../utils/ids'
import { normalizeBranchName } from '../utils/branch'
import type { BranchSummary, BranchModalState, ChatTimelineRow, CommitModalState, CommitNode, MergeModalState } from '../types'

type ChatMutationOptions = {
  workspaceId: Ref<string>
  branchId: Ref<string>
  userId: ComputedRef<string | null>
  router: Router
  branchList: Ref<BranchSummary[]>
  commits: Ref<CommitNode[]>
  messages: Ref<ChatTimelineRow[]>
  snapshots: Record<string, ChatTimelineRow[]>
  activeBranch: Ref<string>
  currentHead: Ref<string>
  serverHeadCommitId: Ref<string | null>
  isDetached: ComputedRef<boolean>
  toastNow: (title: string, message: string, timeoutMs?: number) => void
  saveCurrentHeadSnapshot: () => void
  focusCommitInChat: (commitHash: string) => void
  scrollToBottom: (elementId: string) => void
  scrollToCommitInSidebar: (hash: string) => void
  loadMessagesLatest: (targetBranchId?: string) => Promise<void>
  cloneRows: (rows: ChatTimelineRow[]) => ChatTimelineRow[]
  commitModal: CommitModalState
  branchModal: BranchModalState
  mergeModal: MergeModalState
}

const nowLabel = () => {
  const date = new Date()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function useChatMutations(options: ChatMutationOptions) {
  const committing = ref(false)
  const merging = ref(false)

  function appendCommitToGraph(newHash: string, parentHash: string | null, message: string, branchName: string, branchId?: string) {
    const parentCommit =
      options.commits.value.find((commit) => commit.hash === parentHash) ?? options.commits.value[options.commits.value.length - 1]

    options.commits.value.push({
      hash: newHash,
      parentId: parentHash,
      mergeParentId: null,
      isMerge: false,
      mergeType: undefined,
      branch: branchName,
      branchId: branchId ?? options.branchId.value,
      msg: message,
      time: nowLabel(),
      col: parentCommit?.col ?? 0,
      shortSummary: null,
      longSummary: null,
    })

    options.currentHead.value = newHash
  }

  async function createCommitOnServer(
    keyPoint: string,
    extraOptions: { silent?: boolean; closeModal?: boolean } = {},
  ): Promise<string> {
    const result = await createCommit(
      options.workspaceId.value,
      options.branchId.value,
      {
        workspaceId: options.workspaceId.value,
        branchId: options.branchId.value,
        keyPoint,
        shortSummary: null,
        longSummary: null,
      },
      options.userId.value ?? undefined,
    )

    const created = result.commit
    const newHash = created.id
    if (!newHash) {
      throw new Error('commit id missing')
    }

    const parentHash = created.parentId ? String(created.parentId) : options.currentHead.value
    const finalMessage = created.keyPoint || keyPoint
    appendCommitToGraph(newHash, parentHash || null, finalMessage, options.activeBranch.value, options.branchId.value)
    options.serverHeadCommitId.value = newHash

    if (extraOptions.closeModal) {
      options.commitModal.open = false
    }

    if (!extraOptions.silent) {
      await options.loadMessagesLatest(options.branchId.value)
      options.focusCommitInChat(newHash)
      options.saveCurrentHeadSnapshot()
      options.toastNow('Committed', `[${newHash.slice(0, 8)}] ${finalMessage}`)
    }

    options.scrollToBottom('chat-box')
    options.scrollToCommitInSidebar(newHash)
    return newHash
  }

  async function getPendingMessageCount() {
    const messages = await listTimelineAfter(options.workspaceId.value, options.branchId.value, 0, 200)
    return messages.filter((message) => !message.commitId).length
  }

  async function confirmCommit() {
    if (committing.value) return

    const message = options.commitModal.message.trim()
    if (!message) {
      options.toastNow('Commit', '커밋 메시지를 입력해줘')
      return
    }

    try {
      committing.value = true
      await createCommitOnServer(message, { closeModal: true })
    } catch (error) {
      options.toastNow('Commit', extractApiErrorMessage(error, '커밋 생성 실패'))
    } finally {
      committing.value = false
    }
  }

  async function confirmBranch() {
    const name = normalizeBranchName(options.branchModal.name)
    if (!name) {
      options.toastNow('Branch', '브랜치 이름을 입력해줘')
      return
    }

    if (options.commits.value.some((commit) => commit.branch === name)) {
      options.toastNow('Branch', '이미 존재하는 브랜치야')
      return
    }

    try {
      const baseHash = options.currentHead.value

      if (options.isDetached.value) {
        const pendingCount = await getPendingMessageCount()
        if (pendingCount > 0) {
          options.toastNow('Branch', `미커밋 대화 ${pendingCount}건을 먼저 저장합니다.`, 2200)
          const autoMessage = `AUTO_SAVE before branching from ${String(baseHash).slice(0, 8)}`
          const baseSnapshot = options.snapshots[baseHash]

          await createCommitOnServer(autoMessage, { silent: true })

          if (baseSnapshot) {
            options.messages.value = options.cloneRows(baseSnapshot)
            options.currentHead.value = baseHash
          }

          options.toastNow('Branch', '미커밋 대화를 먼저 저장했어요.', 1800)
        }
      }

      const created = await createBranch(options.workspaceId.value, {
        workspaceId: options.workspaceId.value,
        name,
        description: `Created from ${baseHash}`,
        isDefault: false,
        baseCommitId: isUuid(baseHash) ? baseHash : null,
      })

      if (!created.id) {
        throw new Error('branch id missing')
      }

      options.branchModal.open = false
      options.toastNow('Branch created', `${created.name} 브랜치로 이동합니다.`)
      await options.router.push(`/w/${options.workspaceId.value}/b/${created.id}`)
    } catch (error) {
      options.toastNow('Branch', extractApiErrorMessage(error, '브랜치 생성 실패'))
    }
  }

  async function confirmMerge() {
    if (merging.value) return

    if (!options.mergeModal.fromBranchId || !options.mergeModal.toBranchId) {
      options.toastNow('Merge', '병합할 대상 브랜치를 선택해 주세요.')
      return
    }

    if (options.mergeModal.fromBranchId === options.mergeModal.toBranchId) {
      options.toastNow('Merge', '동일한 브랜치로는 병합할 수 없습니다.')
      return
    }

    try {
      merging.value = true

      await createMerge(options.workspaceId.value, {
        workspaceId: options.workspaceId.value,
        fromBranchId: options.mergeModal.fromBranchId,
        toBranchId: options.mergeModal.toBranchId,
        mergeType: options.mergeModal.mergeType,
        notes: options.mergeModal.notes,
      })

      options.toastNow('Merge', '브랜치 병합이 성공적으로 완료되었습니다.')
      options.mergeModal.open = false
      await options.router.push(`/w/${options.workspaceId.value}/b/${options.mergeModal.toBranchId}`)
    } catch (error) {
      options.toastNow('Merge', extractApiErrorMessage(error, '병합 실패'))
    } finally {
      merging.value = false
    }
  }

  return {
    committing,
    merging,
    createCommitOnServer,
    confirmCommit,
    confirmBranch,
    confirmMerge,
  }
}
