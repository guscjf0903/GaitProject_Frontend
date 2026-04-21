import type { SseHandlers } from '../sseChatStream'
import { streamChatSse } from '../sseChatStream'
import { OpenAPI } from '../generated'

export type StreamChatRequest = {
  workspaceId: string
  branchId: string
  content: string
  contextCommitId?: string | null
}

export async function streamChat(request: StreamChatRequest, handlers?: SseHandlers, signal?: AbortSignal) {
  return streamChatSse({
    url: `${OpenAPI.BASE || 'http://localhost:8080'}/api/chat/stream`,
    token: localStorage.getItem('gait_access_token'),
    signal,
    body: request,
    handlers,
  })
}
