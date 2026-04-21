import { COMMIT_LIST_MIN_WIDTH, GRAPH_PANE_MAX_WIDTH, GRAPH_PANE_MIN_WIDTH, ROW_HEIGHT, START_X, TRACK_GAP } from '../constants'
import type { BranchSummary, CommitNode, GraphNode, GraphPath } from '../types'
import { getBranchColor } from './branch'

export function buildCommitByHashMap(commits: CommitNode[]): Record<string, CommitNode> {
  const map: Record<string, CommitNode> = {}
  commits.forEach((commit) => {
    map[commit.hash] = commit
  })
  return map
}

export function buildLineage(commitByHashMap: Record<string, CommitNode>, head: string) {
  const lineage = new Set<string>()
  const seen = new Set<string>()
  let current = head

  while (current && !seen.has(current)) {
    lineage.add(current)
    seen.add(current)
    current = commitByHashMap[current]?.parentId ?? ''
  }

  return lineage
}

export function buildBranchLineage(commitByHashMap: Record<string, CommitNode>, headCommitId: string | null) {
  if (!headCommitId) return []

  const reversed: string[] = []
  const seen = new Set<string>()
  let current = headCommitId

  while (current && !seen.has(current)) {
    reversed.push(current)
    seen.add(current)
    current = commitByHashMap[current]?.parentId ?? ''
  }

  return reversed.reverse()
}

export function buildBranchOrderMap(lineage: string[]) {
  const order: Record<string, number> = {}
  lineage.forEach((hash, index) => {
    order[hash] = index
  })
  return order
}

export function buildBranchTrackMap(branches: BranchSummary[], commits: CommitNode[]) {
  const map: Record<string, number> = {}
  let next = 0

  const sortedBranches = [...branches].sort((left, right) => {
    if (left.name === 'main') return -1
    if (right.name === 'main') return 1
    return left.name.localeCompare(right.name)
  })

  for (const branch of sortedBranches) {
    if (typeof map[branch.id] !== 'undefined') continue
    map[branch.id] = next++
  }

  for (const commit of commits) {
    const key = commit.branchId ? String(commit.branchId) : `name:${commit.branch}`
    if (typeof map[key] === 'undefined') {
      map[key] = next++
    }
  }

  return map
}

export function buildCommitTrackMap(commits: CommitNode[], branchTrackMap: Record<string, number>) {
  const map: Record<string, number> = {}

  commits.forEach((commit) => {
    const key = commit.branchId ? String(commit.branchId) : `name:${commit.branch}`
    map[commit.hash] = branchTrackMap[key] ?? 0
  })

  return map
}

export function buildGraphNodes(
  commits: CommitNode[],
  commitTrackMap: Record<string, number>,
  selectedLineageSet: Set<string>,
): GraphNode[] {
  return commits.map((commit, index) => {
    const track = commitTrackMap[commit.hash] ?? 0

    return {
      hash: commit.hash,
      x: START_X + track * TRACK_GAP,
      y: index * ROW_HEIGHT + ROW_HEIGHT / 2,
      color: getBranchColor(commit.branch),
      isActive: selectedLineageSet.has(commit.hash),
      track,
      row: index,
      isMerge: commit.isMerge === true,
    }
  })
}

function pickViaTrack(rowTrack: number[], fromTrack: number, toTrack: number, fromRow: number, toRow: number, maxTrack: number) {
  if (Math.abs(fromTrack - toTrack) <= 1) return toTrack

  const minTrack = Math.min(fromTrack, toTrack)
  const maxBetween = Math.max(fromTrack, toTrack)
  const usedMid = new Set<number>()

  for (let row = fromRow + 1; row < toRow; row += 1) {
    const track = rowTrack[row]
    if (typeof track === 'number') usedMid.add(track)
  }

  for (let track = minTrack + 1; track < maxBetween; track += 1) {
    if (!usedMid.has(track)) return track
  }

  for (let distance = 1; distance <= 4; distance += 1) {
    const right = maxBetween + distance
    if (right <= maxTrack + 4 && !usedMid.has(right)) return right

    const left = minTrack - distance
    if (left >= 0 && !usedMid.has(left)) return left
  }

  return toTrack
}

export function buildGraphPaths(commits: CommitNode[], nodes: GraphNode[], selectedLineageSet: Set<string>): GraphPath[] {
  const paths: GraphPath[] = []
  const nodesMap: Record<string, GraphNode> = {}

  nodes.forEach((node) => {
    nodesMap[node.hash] = node
  })

  const maxTrack = nodes.reduce((max, node) => Math.max(max, node.track), 0)
  const rowTrack = nodes.map((node) => node.track)

  commits.forEach((commit) => {
    if (!commit.parentId) return

    const currentNode = nodesMap[commit.hash]
    const parentNode = nodesMap[commit.parentId]
    if (!currentNode || !parentNode) return

    const viaTrack = pickViaTrack(rowTrack, parentNode.track, currentNode.track, parentNode.row, currentNode.row, maxTrack)
    const viaX = START_X + viaTrack * TRACK_GAP
    const cp1y = parentNode.y + ROW_HEIGHT * 0.55
    const cp2y = currentNode.y - ROW_HEIGHT * 0.45

    let d = `M ${parentNode.x} ${parentNode.y} `
    if (parentNode.x === currentNode.x) {
      d += `L ${currentNode.x} ${currentNode.y}`
    } else if (viaTrack === currentNode.track) {
      d += `C ${parentNode.x} ${cp1y}, ${currentNode.x} ${cp2y}, ${currentNode.x} ${currentNode.y}`
    } else {
      const midY = (cp1y + cp2y) / 2
      d += `C ${parentNode.x} ${cp1y}, ${viaX} ${cp1y}, ${viaX} ${midY} `
      d += `L ${viaX} ${cp2y} `
      d += `C ${viaX} ${cp2y}, ${currentNode.x} ${cp2y}, ${currentNode.x} ${currentNode.y}`
    }

    const isActive = selectedLineageSet.has(commit.hash) && selectedLineageSet.has(commit.parentId)
    paths.push({ d, color: getBranchColor(commit.branch), isActive, isMergeEdge: false })
  })

  commits.forEach((commit) => {
    if (!commit.mergeParentId) return

    const currentNode = nodesMap[commit.hash]
    const mergeParentNode = nodesMap[commit.mergeParentId]
    if (!currentNode || !mergeParentNode) return

    const viaTrack = pickViaTrack(rowTrack, mergeParentNode.track, currentNode.track, mergeParentNode.row, currentNode.row, maxTrack)
    const viaX = START_X + viaTrack * TRACK_GAP
    const cp1y = mergeParentNode.y + ROW_HEIGHT * 0.55
    const cp2y = currentNode.y - ROW_HEIGHT * 0.45

    let d = `M ${mergeParentNode.x} ${mergeParentNode.y} `
    if (mergeParentNode.x === currentNode.x) {
      d += `L ${currentNode.x} ${currentNode.y}`
    } else if (viaTrack === currentNode.track) {
      d += `C ${mergeParentNode.x} ${cp1y}, ${currentNode.x} ${cp2y}, ${currentNode.x} ${currentNode.y}`
    } else {
      const midY = (cp1y + cp2y) / 2
      d += `C ${mergeParentNode.x} ${cp1y}, ${viaX} ${cp1y}, ${viaX} ${midY} `
      d += `L ${viaX} ${cp2y} `
      d += `C ${viaX} ${cp2y}, ${currentNode.x} ${cp2y}, ${currentNode.x} ${currentNode.y}`
    }

    paths.push({ d, color: getBranchColor(commit.branch), isActive: false, isMergeEdge: true })
  })

  return paths
}

export function buildGraphPaneRenderWidth(sidebarWidth: number, graphPaneWidth: number, requiredWidth: number) {
  const maxGraph = Math.max(GRAPH_PANE_MIN_WIDTH, Math.min(GRAPH_PANE_MAX_WIDTH, sidebarWidth - COMMIT_LIST_MIN_WIDTH))
  const minGraph = Math.max(GRAPH_PANE_MIN_WIDTH, requiredWidth)
  return Math.max(minGraph, Math.min(graphPaneWidth, Math.max(minGraph, maxGraph)))
}
