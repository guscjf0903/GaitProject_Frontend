import type { MessageResponse } from '../../../api/generated'
import type { ChatTimelineRow, CommitNode } from '../types'
import { shortHash } from './ids'

export const toUiRole = (role: string) => (role === 'USER' ? 'user' : 'ai')

export function buildCommitLabel(commitId: string, commitByHashMap: Record<string, CommitNode>) {
  const title = String(commitByHashMap[commitId]?.msg ?? 'COMMIT')
  return `${title} (${shortHash(commitId)})`
}

export function buildTimelineRows(
  committedRaw: MessageResponse[],
  pendingRaw: MessageResponse[],
  currentHead: string,
  commitByHashMap: Record<string, CommitNode>,
): ChatTimelineRow[] {
  const rows: ChatTimelineRow[] = []
  const messagesByCommit = new Map<string, MessageResponse[]>()

  for (const message of committedRaw) {
    const commitId = message.commitId ? String(message.commitId) : null
    if (!commitId) continue

    if (!messagesByCommit.has(commitId)) {
      messagesByCommit.set(commitId, [])
    }

    messagesByCommit.get(commitId)?.push(message)
  }

  const lineage: string[] = []
  const visited = new Set<string>()
  let current: string | null = currentHead

  while (current && !visited.has(current)) {
    visited.add(current)
    lineage.push(current)
    current = commitByHashMap[current]?.parentId ?? null
  }

  lineage.reverse()

  const lineageSet = new Set(lineage)
  const extraCommitIds: string[] = []
  for (const commitId of messagesByCommit.keys()) {
    if (!lineageSet.has(commitId)) {
      extraCommitIds.push(commitId)
    }
  }

  for (const commitHash of [...lineage, ...extraCommitIds]) {
    const commit = commitByHashMap[commitHash]
    const messages = messagesByCommit.get(commitHash) ?? []

    if (commit?.isMerge) {
      rows.push({
        type: 'merge',
        hash: commitHash,
        text: commit.msg || 'Merged',
        mergeType: commit.mergeType,
        shortSummary: commit.shortSummary,
        longSummary: commit.longSummary,
      })
    } else if (messages.length > 0) {
      rows.push({
        type: 'commit',
        hash: commitHash,
        text: buildCommitLabel(commitHash, commitByHashMap),
      })
    }

    for (const message of messages) {
      rows.push({
        type: 'message',
        role: toUiRole(String(message.role ?? 'ASSISTANT')),
        text: String(message.content ?? ''),
        messageId: message.id ? String(message.id) : undefined,
        commitId: commitHash,
        sequence: typeof message.sequence === 'number' ? message.sequence : undefined,
      })
    }
  }

  const pending = pendingRaw.filter((message) => !message.commitId)
  if (pending.length > 0) {
    rows.push({
      type: 'commit',
      hash: 'WORKING_TREE',
      text: 'WORKING TREE (uncommitted)',
      isWorkingTree: true,
    })

    for (const message of pending) {
      rows.push({
        type: 'message',
        role: toUiRole(String(message.role ?? 'ASSISTANT')),
        text: String(message.content ?? ''),
        messageId: message.id ? String(message.id) : undefined,
        commitId: null,
        sequence: typeof message.sequence === 'number' ? message.sequence : undefined,
      })
    }
  }

  return rows
}
