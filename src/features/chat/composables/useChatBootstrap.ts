import { ref, type ComputedRef, type Ref } from 'vue'
import type { Router } from 'vue-router'
import type { BranchResponse, CommitResponse } from '../../../api/generated'
import {
  listBranchCommits,
  listTimelineAfter,
  listTimelineAtCommit,
  listWorkspaceBranches,
} from '../../../api/clients'
import type { BranchSummary, ChatTimelineRow, CommitNode } from '../types'

type ChatBootstrapOptions = {
  workspaceId: Ref<string>
  branchId: Ref<string>
  activeBranch: Ref<string>
  currentHead: Ref<string>
  serverHeadCommitId: Ref<string | null>
  branchList: Ref<BranchSummary[]>
  commits: Ref<CommitNode[]>
  pendingCheckoutCommitId: Ref<string | null>
  streaming: Ref<boolean>
  currentBranchHeadLineageSet: ComputedRef<Set<string>>
  commitByHashMap: ComputedRef<Record<string, CommitNode>>
  latestLoadedBranchId: Ref<string | null>
  snapshots: Record<string, ChatTimelineRow[]>
  messages: Ref<ChatTimelineRow[]>
  replaceMessages: (rows: ChatTimelineRow[]) => void
  setTimelineFromRaw: (committedRaw: any[], pendingRaw: any[]) => void
  saveCurrentHeadSnapshot: () => void
  cloneRows: (rows: ChatTimelineRow[]) => ChatTimelineRow[]
  focusCommitInChat: (commitHash: string) => void
  scrollToBottom: (elementId: string) => void
  scrollToCommitInSidebar: (hash: string) => void
  toastNow: (title: string, message: string, timeoutMs?: number) => void
  router: Router
}

function mapBranchSummary(branches: BranchResponse[]): BranchSummary[] {
  return branches.map((branch) => ({
    id: String(branch.id ?? ''),
    name: String(branch.name ?? ''),
    baseCommitId: branch.baseCommitId ? String(branch.baseCommitId) : null,
    headCommitId: branch.headCommitId ? String(branch.headCommitId) : null,
  }))
}

function mapCommitNode(commits: CommitResponse[], branchNameById: Record<string, string>, fallbackBranchId: string): CommitNode[] {
  return commits
    .slice()
    .sort((left, right) => String(left.createdAt ?? '').localeCompare(String(right.createdAt ?? '')))
    .map((commit) => {
      const branchId = String(commit.branchId ?? fallbackBranchId)
      return {
        hash: String(commit.id),
        parentId: commit.parentId ? String(commit.parentId) : null,
        mergeParentId: commit.mergeParentId ? String(commit.mergeParentId) : null,
        isMerge: commit.isMerge === true,
        mergeType: commit.mergeType ? String(commit.mergeType) : undefined,
        branch: branchNameById[branchId] ?? 'main',
        branchId,
        msg: String(commit.keyPoint ?? 'COMMIT'),
        time: commit.createdAt
          ? new Date(commit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
        col: 0,
        shortSummary: commit.shortSummary ?? null,
        longSummary: commit.longSummary ?? null,
      }
    })
}

export function useChatBootstrap(options: ChatBootstrapOptions) {
  const loadingTimeline = ref(false)
  const loadingCommitId = ref<string | null>(null)
  let timelineSeq = 0
  let bootSeq = 0

  async function loadMessagesLatest(targetBranchId = options.branchId.value) {
    const seq = ++timelineSeq
    loadingTimeline.value = true
    loadingCommitId.value = null

    try {
      const branches = await listWorkspaceBranches(options.workspaceId.value)
      if (seq !== timelineSeq) return

      const currentBranch = branches.find((branch) => branch.id === targetBranchId)
      const headCommitId = currentBranch?.headCommitId ? String(currentBranch.headCommitId) : undefined

      if (targetBranchId === options.branchId.value) {
        options.serverHeadCommitId.value = headCommitId ?? null
      }

      const localHeadSnapshot = headCommitId ? options.snapshots[headCommitId] : undefined
      const [committedMessages, pendingMessages] = await Promise.all([
        headCommitId
          ? listTimelineAtCommit(options.workspaceId.value, targetBranchId, headCommitId, 1000)
          : Promise.resolve([]),
        listTimelineAfter(options.workspaceId.value, targetBranchId, 0, 400),
      ])

      if (seq !== timelineSeq) return

      options.setTimelineFromRaw(committedMessages, pendingMessages)
      options.latestLoadedBranchId.value = targetBranchId

      if (headCommitId && localHeadSnapshot && localHeadSnapshot.length > options.messages.value.length) {
        options.replaceMessages(options.cloneRows(localHeadSnapshot))
        options.toastNow('Timeline', '서버 반영 전 최근 대화가 있어 로컬 화면을 유지했어요.', 2200)
      }

      options.scrollToBottom('chat-box')
    } finally {
      if (seq === timelineSeq) {
        loadingTimeline.value = false
        loadingCommitId.value = null
      }
    }
  }

  async function refreshCurrentBranchCommits(targetBranchId = options.branchId.value) {
    try {
      const branches = await listWorkspaceBranches(options.workspaceId.value)
      const currentBranch = branches.find((branch) => branch.id === targetBranchId)
      if (!currentBranch) return

      if (targetBranchId === options.branchId.value) {
        options.serverHeadCommitId.value = currentBranch.headCommitId ? String(currentBranch.headCommitId) : null
      }

      const serverCommits = (await listBranchCommits(options.workspaceId.value, targetBranchId, 300)).slice().reverse()
      if (serverCommits.length === 0) return

      const existing = new Set(options.commits.value.map((commit) => commit.hash))
      for (const commit of serverCommits) {
        const commitId = commit.id ? String(commit.id) : ''
        if (!commitId || existing.has(commitId)) continue

        options.commits.value.push({
          hash: commitId,
          parentId: commit.parentId ? String(commit.parentId) : null,
          mergeParentId: commit.mergeParentId ? String(commit.mergeParentId) : null,
          isMerge: commit.isMerge === true,
          mergeType: commit.mergeType ? String(commit.mergeType) : undefined,
          branch: String(currentBranch.name ?? options.activeBranch.value ?? 'main'),
          branchId: targetBranchId,
          msg: String(commit.keyPoint ?? 'COMMIT'),
          time: commit.createdAt
            ? new Date(commit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          col: 0,
          shortSummary: commit.shortSummary ?? null,
          longSummary: commit.longSummary ?? null,
        })
        existing.add(commitId)
      }
    } catch {
      // Best-effort refresh only.
    }
  }

  async function checkout(commit: { hash: string; branch: string; branchId?: string }) {
    if (options.streaming.value) return

    options.saveCurrentHeadSnapshot()
    const currentBranchName =
      options.branchList.value.find((branch) => branch.id === options.branchId.value)?.name ?? options.activeBranch.value

    const isCrossBranchCommit = Boolean(commit.branchId && commit.branchId !== options.branchId.value)
    const isAncestorOfCurrentBranchHead = options.currentBranchHeadLineageSet.value.has(commit.hash)

    if (isCrossBranchCommit && !isAncestorOfCurrentBranchHead) {
      options.pendingCheckoutCommitId.value = commit.hash
      await options.router.push(`/w/${options.workspaceId.value}/b/${commit.branchId}`)
      return
    }

    options.currentHead.value = commit.hash
    options.activeBranch.value = currentBranchName

    if (options.latestLoadedBranchId.value !== options.branchId.value) {
      await loadMessagesLatest(options.branchId.value)
    }

    options.focusCommitInChat(commit.hash)
    options.scrollToCommitInSidebar(commit.hash)
  }

  async function checkoutByHash(hash: string) {
    const commit = options.commits.value.find((item) => item.hash === hash)
    if (commit) await checkout(commit)
  }

  async function bootstrapFromServer() {
    const seq = ++bootSeq

    try {
      const branches = await listWorkspaceBranches(options.workspaceId.value)
      const currentBranch = branches.find((branch) => branch.id === options.branchId.value)
      if (!currentBranch || seq !== bootSeq) return

      options.branchList.value = mapBranchSummary(branches)
      options.activeBranch.value = String(currentBranch.name ?? 'main')
      options.serverHeadCommitId.value = currentBranch.headCommitId ? String(currentBranch.headCommitId) : null

      const branchNameById: Record<string, string> = {}
      branches.forEach((branch) => {
        if (branch.id && branch.name) {
          branchNameById[String(branch.id)] = String(branch.name)
        }
      })

      const commitLists = await Promise.all(
        branches
          .filter((branch) => branch.id)
          .map(async (branch) => listBranchCommits(options.workspaceId.value, String(branch.id), 300)),
      )
      if (seq !== bootSeq) return

      const unique = new Map<string, CommitResponse>()
      commitLists.forEach((list) => {
        list.forEach((commit) => {
          if (commit.id) {
            unique.set(String(commit.id), commit)
          }
        })
      })

      options.commits.value = mapCommitNode(Array.from(unique.values()), branchNameById, options.branchId.value)

      const headHash =
        (currentBranch.headCommitId ? String(currentBranch.headCommitId) : undefined) ??
        options.commits.value[options.commits.value.length - 1]?.hash
      if (headHash) {
        options.currentHead.value = headHash
      }

      if (options.pendingCheckoutCommitId.value) {
        const target = options.pendingCheckoutCommitId.value
        options.pendingCheckoutCommitId.value = null
        options.currentHead.value = target
        await loadMessagesLatest(options.branchId.value)
        options.focusCommitInChat(target)
      } else {
        await loadMessagesLatest(options.branchId.value)
      }

      options.saveCurrentHeadSnapshot()
      options.scrollToBottom('graph-container')
      options.scrollToBottom('chat-box')
    } catch {
      // Ignore bootstrap failures for MVP parity.
    }
  }

  return {
    loadingTimeline,
    loadingCommitId,
    loadMessagesLatest,
    refreshCurrentBranchCommits,
    checkout,
    checkoutByHash,
    bootstrapFromServer,
  }
}
