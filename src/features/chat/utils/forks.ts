import type { BranchSummary, CommitNode } from '../types'

export function getForkBranches(
  branchList: BranchSummary[],
  commitByHashMap: Record<string, CommitNode>,
  commitHash: string,
) {
  const ownerBranchId = commitByHashMap[commitHash]?.branchId

  return branchList
    .filter((branch) => branch.baseCommitId === commitHash && branch.id !== ownerBranchId)
    .map((branch) => ({ id: branch.id, name: branch.name }))
}
