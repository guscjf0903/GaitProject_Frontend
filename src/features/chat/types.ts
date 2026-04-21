export type BranchSummary = {
  id: string
  name: string
  baseCommitId: string | null
  headCommitId: string | null
}

export type CommitNode = {
  hash: string
  parentId: string | null
  mergeParentId: string | null
  isMerge: boolean
  mergeType?: string
  branch: string
  branchId?: string
  msg: string
  time: string
  col: number
  shortSummary?: string | null
  longSummary?: string | null
}

export type ChatTimelineRow =
  | {
      type: 'message'
      role: 'user' | 'ai'
      text: string
      model?: string
      messageId?: string
      commitId?: string | null
      sequence?: number
    }
  | {
      type: 'commit'
      hash: string
      text: string
      isWorkingTree?: boolean
    }
  | {
      type: 'merge'
      hash: string
      text: string
      mergeType?: string
      shortSummary?: string | null
      longSummary?: string | null
      expanded?: boolean
    }

export type GraphNode = {
  hash: string
  x: number
  y: number
  color: string
  isActive: boolean
  track: number
  row: number
  isMerge: boolean
}

export type GraphPath = {
  d: string
  color: string
  isActive: boolean
  isMergeEdge: boolean
}

export type ChatToastState = {
  show: boolean
  title: string
  message: string
  timeoutId: ReturnType<typeof setTimeout> | null
}

export type CommitModalState = {
  open: boolean
  message: string
}

export type BranchModalState = {
  open: boolean
  name: string
}

export type MergeModalState = {
  open: boolean
  fromBranchId: string
  toBranchId: string
  mergeType: 'SQUASH' | 'DEEP'
  notes: string
}

export type ChatModalState = {
  commit: CommitModalState
  branch: BranchModalState
  merge: MergeModalState
}
