import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { BranchSummary, CommitNode } from '../types'
import {
  buildBranchLineage,
  buildBranchOrderMap,
  buildBranchTrackMap,
  buildCommitByHashMap,
  buildCommitTrackMap,
  buildGraphNodes,
  buildGraphPaneRenderWidth,
  buildGraphPaths,
  buildLineage,
} from '../utils/graph'
import { START_X, TRACK_GAP } from '../constants'

type ChatGraphStateOptions = {
  commits: MaybeRefOrGetter<CommitNode[]>
  branchList: MaybeRefOrGetter<BranchSummary[]>
  currentHead: MaybeRefOrGetter<string>
  serverHeadCommitId: MaybeRefOrGetter<string | null>
  sidebarWidth: MaybeRefOrGetter<number>
  graphPaneWidth: MaybeRefOrGetter<number>
}

export function useChatGraphState(options: ChatGraphStateOptions) {
  const commits = computed(() => toValue(options.commits))
  const branchList = computed(() => toValue(options.branchList))
  const currentHead = computed(() => toValue(options.currentHead))
  const serverHeadCommitId = computed(() => toValue(options.serverHeadCommitId))
  const sidebarWidth = computed(() => toValue(options.sidebarWidth))
  const graphPaneWidth = computed(() => toValue(options.graphPaneWidth))

  const commitByHashMap = computed(() => buildCommitByHashMap(commits.value))
  const selectedLineageSet = computed(() => buildLineage(commitByHashMap.value, currentHead.value))
  const branchLineageFromHead = computed(() => buildBranchLineage(commitByHashMap.value, serverHeadCommitId.value))
  const branchOrderMap = computed(() => buildBranchOrderMap(branchLineageFromHead.value))
  const currentBranchHeadLineageSet = computed(() => new Set(branchLineageFromHead.value))

  const selectedOrder = computed(() => {
    const head = serverHeadCommitId.value
    if (!head) return -1

    const selected = currentHead.value
    if (typeof branchOrderMap.value[selected] === 'number') return branchOrderMap.value[selected]
    return typeof branchOrderMap.value[head] === 'number' ? branchOrderMap.value[head] : -1
  })

  const headOrder = computed(() => {
    const head = serverHeadCommitId.value
    if (!head) return -1
    return typeof branchOrderMap.value[head] === 'number' ? branchOrderMap.value[head] : -1
  })

  const branchTrackMap = computed(() => buildBranchTrackMap(branchList.value, commits.value))
  const commitTrackMap = computed(() => buildCommitTrackMap(commits.value, branchTrackMap.value))
  const graphNodes = computed(() => buildGraphNodes(commits.value, commitTrackMap.value, selectedLineageSet.value))
  const graphPaths = computed(() => buildGraphPaths(commits.value, graphNodes.value, selectedLineageSet.value))
  const containerHeight = computed(() => commits.value.length * 60)
  const maxTrackInGraph = computed(() => graphNodes.value.reduce((max, node) => Math.max(max, node.track), 0))
  const requiredGraphPaneWidth = computed(() => START_X + (maxTrackInGraph.value + 1) * TRACK_GAP + 26)
  const graphPaneRenderWidth = computed(() =>
    buildGraphPaneRenderWidth(sidebarWidth.value, graphPaneWidth.value, requiredGraphPaneWidth.value),
  )
  const isDetached = computed(() => Boolean(serverHeadCommitId.value && serverHeadCommitId.value !== currentHead.value))

  return {
    commitByHashMap,
    selectedLineageSet,
    branchLineageFromHead,
    branchOrderMap,
    currentBranchHeadLineageSet,
    selectedOrder,
    headOrder,
    graphNodes,
    graphPaths,
    containerHeight,
    graphPaneRenderWidth,
    isDetached,
  }
}
