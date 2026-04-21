import {
  BranchesService,
  CommitsService,
  MessagesService,
  MergesService,
  type BranchCreateRequest,
  type BranchResponse,
  type CommitCreateRequest,
  type CommitCreateResultResponse,
  type CommitResponse,
  type MergeCreateRequest,
  type MergeResponse,
  type MessageResponse,
  type WorkspaceCreateRequest,
  type WorkspaceResponse,
  UsersService,
  WorkspacesService,
} from '../generated'
import { requireData } from './base'

export async function listUserWorkspaces(userId: string): Promise<WorkspaceResponse[]> {
  const response = await UsersService.list1(userId)
  return response.data ?? []
}

export async function createWorkspace(request: WorkspaceCreateRequest): Promise<WorkspaceResponse> {
  const response = await WorkspacesService.create(request)
  return requireData(response.data, '워크스페이스 생성 응답이 비어 있습니다.')
}

export async function getWorkspace(workspaceId: string): Promise<WorkspaceResponse> {
  const response = await WorkspacesService.get(workspaceId)
  return requireData(response.data, '워크스페이스 조회 응답이 비어 있습니다.')
}

export async function listWorkspaceBranches(workspaceId: string): Promise<BranchResponse[]> {
  const response = await BranchesService.listByWorkspace(workspaceId)
  return response.data ?? []
}

export async function createBranch(workspaceId: string, request: BranchCreateRequest): Promise<BranchResponse> {
  const response = await BranchesService.create2(workspaceId, request)
  return requireData(response.data, '브랜치 생성 응답이 비어 있습니다.')
}

export async function listBranchCommits(
  workspaceId: string,
  branchId: string,
  limit = 200,
): Promise<CommitResponse[]> {
  const response = await CommitsService.list(workspaceId, branchId, limit)
  return response.data ?? []
}

export async function createCommit(
  workspaceId: string,
  branchId: string,
  request: CommitCreateRequest,
  createdByUserId?: string,
): Promise<CommitCreateResultResponse> {
  const response = await CommitsService.create3(workspaceId, branchId, request, createdByUserId)
  return requireData(response.data, '커밋 생성 응답이 비어 있습니다.')
}

export async function listTimelineAfter(
  workspaceId: string,
  branchId: string,
  after = 0,
  limit = 50,
): Promise<MessageResponse[]> {
  const response = await MessagesService.timelineAfter(workspaceId, branchId, after, limit)
  return response.data ?? []
}

export async function listTimelineAtCommit(
  workspaceId: string,
  branchId: string,
  commitId: string,
  limit = 500,
): Promise<MessageResponse[]> {
  const response = await MessagesService.timelineAtCommit(workspaceId, branchId, commitId, limit)
  return response.data ?? []
}

export async function createMerge(workspaceId: string, request: MergeCreateRequest): Promise<MergeResponse> {
  const response = await MergesService.create1(workspaceId, request)
  return requireData(response.data, '머지 응답이 비어 있습니다.')
}
