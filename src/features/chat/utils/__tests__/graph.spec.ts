import { describe, expect, it } from 'vitest'
import {
  buildBranchLineage,
  buildBranchOrderMap,
  buildCommitByHashMap,
  buildCommitTrackMap,
  buildGraphNodes,
  buildGraphPaneRenderWidth,
  buildGraphPaths,
  buildLineage,
} from '../graph'
import type { CommitNode } from '../../types'

describe('graph helpers', () => {
  const commits: CommitNode[] = [
    {
      hash: 'c1',
      parentId: null,
      mergeParentId: null,
      isMerge: false,
      branch: 'main',
      branchId: 'b-main',
      msg: 'root',
      time: '10:00',
      col: 0,
    },
    {
      hash: 'c2',
      parentId: 'c1',
      mergeParentId: null,
      isMerge: false,
      branch: 'main',
      branchId: 'b-main',
      msg: 'main-2',
      time: '10:05',
      col: 0,
    },
    {
      hash: 'f1',
      parentId: 'c1',
      mergeParentId: null,
      isMerge: false,
      branch: 'feature',
      branchId: 'b-feature',
      msg: 'feature-1',
      time: '10:06',
      col: 1,
    },
    {
      hash: 'm1',
      parentId: 'c2',
      mergeParentId: 'f1',
      isMerge: true,
      mergeType: 'SQUASH',
      branch: 'main',
      branchId: 'b-main',
      msg: 'merge',
      time: '10:10',
      col: 0,
    },
  ]

  it('builds lineage and branch order from the selected head', () => {
    const commitMap = buildCommitByHashMap(commits)

    expect(buildLineage(commitMap, 'm1')).toEqual(new Set(['m1', 'c2', 'c1']))
    expect(buildBranchLineage(commitMap, 'm1')).toEqual(['c1', 'c2', 'm1'])
    expect(buildBranchOrderMap(['c1', 'c2', 'm1'])).toEqual({ c1: 0, c2: 1, m1: 2 })
  })

  it('builds graph nodes and merge/main paths with active-state metadata', () => {
    const commitMap = buildCommitByHashMap(commits)
    const selectedLineage = buildLineage(commitMap, 'm1')
    const trackMap = buildCommitTrackMap(commits, { 'b-main': 0, 'b-feature': 1 })
    const nodes = buildGraphNodes(commits, trackMap, selectedLineage)
    const paths = buildGraphPaths(commits, nodes, selectedLineage)

    expect(nodes).toHaveLength(4)
    expect(nodes.find((node) => node.hash === 'm1')).toMatchObject({
      isMerge: true,
      isActive: true,
      track: 0,
    })
    expect(nodes.find((node) => node.hash === 'f1')).toMatchObject({
      isMerge: false,
      isActive: false,
      track: 1,
    })

    expect(paths).toHaveLength(4)
    expect(paths.filter((path) => path.isMergeEdge)).toHaveLength(1)
    expect(paths.filter((path) => !path.isMergeEdge && path.isActive)).toHaveLength(2)
    expect(paths.filter((path) => !path.isMergeEdge && !path.isActive)).toHaveLength(1)
    expect(paths.some((path) => path.d.includes('C'))).toBe(true)
  })

  it('keeps the graph pane wide enough for graph content and sidebar limits', () => {
    expect(buildGraphPaneRenderWidth(340, 110, 90)).toBe(110)
    expect(buildGraphPaneRenderWidth(280, 80, 160)).toBe(160)
    expect(buildGraphPaneRenderWidth(560, 500, 100)).toBe(320)
  })
})
