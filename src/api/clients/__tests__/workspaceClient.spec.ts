import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, BranchesService, CommitsService, MergesService, MessagesService, UsersService, WorkspacesService } from '../../generated'
import { extractApiErrorMessage } from '../base'
import {
  createBranch,
  createCommit,
  createMerge,
  createWorkspace,
  getWorkspace,
  listBranchCommits,
  listTimelineAfter,
  listTimelineAtCommit,
  listUserWorkspaces,
  listWorkspaceBranches,
} from '../workspaceClient'

describe('workspaceClient adapters', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('maps stable adapter methods to generated services and unwraps data', async () => {
    vi.spyOn(UsersService, 'list1').mockResolvedValue({
      data: [{ id: 'w-1', name: 'Workspace 1' }],
    } as never)
    vi.spyOn(WorkspacesService, 'create').mockResolvedValue({
      data: { id: 'w-2', name: 'Workspace 2' },
    } as never)
    vi.spyOn(WorkspacesService, 'get').mockResolvedValue({
      data: { id: 'w-1', name: 'Workspace 1' },
    } as never)
    vi.spyOn(BranchesService, 'listByWorkspace').mockResolvedValue({
      data: [{ id: 'b-1', name: 'main' }],
    } as never)
    vi.spyOn(BranchesService, 'create2').mockResolvedValue({
      data: { id: 'b-2', name: 'feature/login' },
    } as never)
    vi.spyOn(CommitsService, 'list').mockResolvedValue({
      data: [{ id: 'c-1', branchId: 'b-1', keyPoint: 'Initial commit' }],
    } as never)
    vi.spyOn(CommitsService, 'create3').mockResolvedValue({
      data: { commit: { id: 'c-2', parentId: 'c-1', keyPoint: 'New commit' } },
    } as never)
    vi.spyOn(MessagesService, 'timelineAfter').mockResolvedValue({
      data: [{ id: 'm-1', content: 'after', role: 'USER' }],
    } as never)
    vi.spyOn(MessagesService, 'timelineAtCommit').mockResolvedValue({
      data: [{ id: 'm-2', content: 'at commit', role: 'ASSISTANT' }],
    } as never)
    vi.spyOn(MergesService, 'create1').mockResolvedValue({
      data: { id: 'merge-1', mergeCommitId: 'c-3' },
    } as never)

    await expect(listUserWorkspaces('user-1')).resolves.toEqual([{ id: 'w-1', name: 'Workspace 1' }])
    await expect(createWorkspace({ userId: 'user-1', name: 'Workspace 2', description: null })).resolves.toEqual({
      id: 'w-2',
      name: 'Workspace 2',
    })
    await expect(getWorkspace('w-1')).resolves.toEqual({ id: 'w-1', name: 'Workspace 1' })
    await expect(listWorkspaceBranches('w-1')).resolves.toEqual([{ id: 'b-1', name: 'main' }])
    await expect(
      createBranch('w-1', {
        workspaceId: 'w-1',
        name: 'feature/login',
        description: null,
        isDefault: false,
      }),
    ).resolves.toEqual({
      id: 'b-2',
      name: 'feature/login',
    })
    await expect(listBranchCommits('w-1', 'b-1')).resolves.toEqual([
      { id: 'c-1', branchId: 'b-1', keyPoint: 'Initial commit' },
    ])
    await expect(
      createCommit(
        'w-1',
        'b-1',
        {
          workspaceId: 'w-1',
          branchId: 'b-1',
          keyPoint: 'New commit',
          shortSummary: null,
          longSummary: null,
        },
        'user-1',
      ),
    ).resolves.toEqual({
      commit: { id: 'c-2', parentId: 'c-1', keyPoint: 'New commit' },
    })
    await expect(listTimelineAfter('w-1', 'b-1')).resolves.toEqual([{ id: 'm-1', content: 'after', role: 'USER' }])
    await expect(listTimelineAtCommit('w-1', 'b-1', 'c-1')).resolves.toEqual([
      { id: 'm-2', content: 'at commit', role: 'ASSISTANT' },
    ])
    await expect(
      createMerge('w-1', {
        workspaceId: 'w-1',
        fromBranchId: 'b-feature',
        toBranchId: 'b-main',
        mergeType: 'SQUASH',
        notes: 'merge it',
      }),
    ).resolves.toEqual({
      id: 'merge-1',
      mergeCommitId: 'c-3',
    })
  })

  it('falls back to empty arrays when list endpoints return no data', async () => {
    vi.spyOn(UsersService, 'list1').mockResolvedValue({ data: null } as never)
    vi.spyOn(BranchesService, 'listByWorkspace').mockResolvedValue({ data: null } as never)
    vi.spyOn(CommitsService, 'list').mockResolvedValue({ data: null } as never)
    vi.spyOn(MessagesService, 'timelineAfter').mockResolvedValue({ data: null } as never)
    vi.spyOn(MessagesService, 'timelineAtCommit').mockResolvedValue({ data: null } as never)

    await expect(listUserWorkspaces('user-1')).resolves.toEqual([])
    await expect(listWorkspaceBranches('w-1')).resolves.toEqual([])
    await expect(listBranchCommits('w-1', 'b-1')).resolves.toEqual([])
    await expect(listTimelineAfter('w-1', 'b-1')).resolves.toEqual([])
    await expect(listTimelineAtCommit('w-1', 'b-1', 'c-1')).resolves.toEqual([])
  })

  it('keeps failure messages human-readable when generated clients throw', () => {
    const apiError = new ApiError(
      { method: 'GET', url: '/api/workspaces', path: {}, errors: {}, query: {}, headers: {}, body: undefined, formData: undefined, mediaType: undefined } as never,
      { url: '/api/workspaces', ok: false, status: 400, statusText: 'Bad Request', body: { message: 'workspace rejected' } },
      'Request failed',
    )

    expect(extractApiErrorMessage(apiError, 'fallback')).toBe('workspace rejected')
    expect(extractApiErrorMessage(new Error('plain failure'), 'fallback')).toBe('plain failure')
  })
})
