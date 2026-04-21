import { describe, expect, it } from 'vitest'
import { buildTimelineRows } from '../timeline'
import type { CommitNode } from '../../types'

describe('buildTimelineRows', () => {
  const commitByHashMap: Record<string, CommitNode> = {
    c1: {
      hash: 'c1',
      parentId: null,
      mergeParentId: null,
      isMerge: false,
      branch: 'main',
      branchId: 'b-main',
      msg: 'Initial commit',
      time: '10:00',
      col: 0,
    },
    c2: {
      hash: 'c2',
      parentId: 'c1',
      mergeParentId: null,
      isMerge: false,
      branch: 'main',
      branchId: 'b-main',
      msg: 'Add feature',
      time: '10:10',
      col: 0,
    },
    m1: {
      hash: 'm1',
      parentId: 'c2',
      mergeParentId: 'f1',
      isMerge: true,
      mergeType: 'DEEP',
      branch: 'main',
      branchId: 'b-main',
      msg: 'Merge branch feature-x',
      time: '10:20',
      col: 0,
      shortSummary: 'Merged feature-x',
      longSummary: 'Merged feature-x into main with AI merge.',
    },
  }

  it('creates commit dividers, committed messages, merge rows, and working tree rows', () => {
    const rows = buildTimelineRows(
      [
        {
          id: 'msg-1',
          commitId: 'c1',
          role: 'USER',
          content: 'hello',
          sequence: 1,
        },
        {
          id: 'msg-2',
          commitId: 'c2',
          role: 'ASSISTANT',
          content: 'world',
          sequence: 2,
        },
      ],
      [
        {
          id: 'pending-1',
          role: 'USER',
          content: 'draft',
          sequence: 3,
        },
      ],
      'm1',
      commitByHashMap,
    )

    expect(rows).toEqual([
      {
        type: 'commit',
        hash: 'c1',
        text: 'Initial commit (c1)',
      },
      {
        type: 'message',
        role: 'user',
        text: 'hello',
        messageId: 'msg-1',
        commitId: 'c1',
        sequence: 1,
      },
      {
        type: 'commit',
        hash: 'c2',
        text: 'Add feature (c2)',
      },
      {
        type: 'message',
        role: 'ai',
        text: 'world',
        messageId: 'msg-2',
        commitId: 'c2',
        sequence: 2,
      },
      {
        type: 'merge',
        hash: 'm1',
        text: 'Merge branch feature-x',
        mergeType: 'DEEP',
        shortSummary: 'Merged feature-x',
        longSummary: 'Merged feature-x into main with AI merge.',
      },
      {
        type: 'commit',
        hash: 'WORKING_TREE',
        text: 'WORKING TREE (uncommitted)',
        isWorkingTree: true,
      },
      {
        type: 'message',
        role: 'user',
        text: 'draft',
        messageId: 'pending-1',
        commitId: null,
        sequence: 3,
      },
    ])
  })

  it('appends committed messages outside the current lineage after the main lineage', () => {
    const rows = buildTimelineRows(
      [
        {
          id: 'msg-extra',
          commitId: 'side-1',
          role: 'ASSISTANT',
          content: 'from another branch',
          sequence: 4,
        },
      ],
      [],
      'c2',
      {
        ...commitByHashMap,
        'side-1': {
          hash: 'side-1',
          parentId: null,
          mergeParentId: null,
          isMerge: false,
          branch: 'feature',
          branchId: 'b-feature',
          msg: 'Feature branch',
          time: '11:00',
          col: 1,
        },
      },
    )

    expect(rows[rows.length - 2]).toEqual({
      type: 'commit',
      hash: 'side-1',
      text: 'Feature branch (side-1)',
    })
    expect(rows[rows.length - 1]).toEqual({
      type: 'message',
      role: 'ai',
      text: 'from another branch',
      messageId: 'msg-extra',
      commitId: 'side-1',
      sequence: 4,
    })
  })
})
