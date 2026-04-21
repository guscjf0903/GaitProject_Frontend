import { onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue'
import { streamChat } from '../../../api/clients'
import type { ChatTimelineRow } from '../types'
import { isUuid } from '../utils/ids'

type ChatStreamOptions = {
  workspaceId: Ref<string>
  branchId: Ref<string>
  currentHead: Ref<string>
  isDetached: ComputedRef<boolean>
  messages: Ref<ChatTimelineRow[]>
  saveCurrentHeadSnapshot: () => void
  scrollToBottom: (elementId: string) => void
  refreshCurrentBranchCommits: (targetBranchId?: string) => Promise<void>
  toastNow: (title: string, message: string, timeoutMs?: number) => void
  openCommitModal: () => void
  openBranchModal: () => void
}

export function useChatStreamActions(options: ChatStreamOptions) {
  const input = ref('')
  const streaming = ref(false)
  let streamAbort: AbortController | null = null

  async function send() {
    if (!input.value.trim()) return

    const workspaceId = options.workspaceId.value
    const branchId = options.branchId.value
    const contextCommitId = options.isDetached.value && isUuid(options.currentHead.value) ? options.currentHead.value : null
    const content = input.value

    options.messages.value.push({ type: 'message', role: 'user', text: content, commitId: null })
    options.saveCurrentHeadSnapshot()
    input.value = ''
    options.scrollToBottom('chat-box')

    const aiIndex = options.messages.value.length
    options.messages.value.push({ type: 'message', role: 'ai', text: '', commitId: null })

    let doneSeen = false

    try {
      streamAbort?.abort()
      streamAbort = new AbortController()
      streaming.value = true

      await streamChat(
        {
          workspaceId,
          branchId,
          contextCommitId,
          content,
        },
        {
          onChunk: (raw) => {
            const chunk = raw?.data?.data?.chunk
            if (typeof chunk !== 'string') return

            const message = options.messages.value[aiIndex]
            if (message?.type === 'message' && message.role === 'ai') {
              message.text += chunk
            }
            options.scrollToBottom('chat-box')
          },
          onDone: async (raw) => {
            doneSeen = true
            streaming.value = false
            streamAbort = null
            options.saveCurrentHeadSnapshot()
            options.scrollToBottom('chat-box')

            const doneData = raw?.data?.data || {}
            const totalTokens = doneData.totalTokens
            const ragUsed = doneData.ragUsed === true
            if (typeof totalTokens === 'number') {
              const ragLabel = ragUsed ? ' (RAG)' : ''
              options.toastNow('Token Usage', `이번 대화: ${totalTokens} tokens 사용${ragLabel}`)
            }

            await options.refreshCurrentBranchCommits(branchId)
          },
          onRagStatus: (raw) => {
            const ragData = raw?.data?.data || {}
            if (ragData.searched && ragData.itemCount > 0) {
              options.toastNow('RAG Search', `과거 기록 ${ragData.itemCount}건 검색 (${ragData.searchDurationMs}ms)`, 2500)
            }
          },
          onError: (raw) => {
            doneSeen = true
            streaming.value = false
            streamAbort = null
            const errorData = raw?.data?.data || {}
            options.toastNow('Stream', errorData.message ?? '스트리밍 중 오류가 발생했습니다.')
          },
        },
        streamAbort.signal,
      )
    } catch (error) {
      streaming.value = false
      streamAbort = null
      if (doneSeen) return

      const message =
        error instanceof Error && error.name === 'AbortError'
          ? '응답 스트리밍을 중단했어요.'
          : error instanceof Error
            ? error.message
            : 'SSE 스트리밍 실패'
      options.toastNow('Stream', message)
    }
  }

  function onInputKeydown(event: KeyboardEvent & { isComposing?: boolean }) {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (event.isComposing) return
      event.preventDefault()
      void send()
      return
    }

    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform)
    const metaPressed = isMac ? event.metaKey : event.ctrlKey
    if (!metaPressed) return

    if (event.key === 'Enter') {
      event.preventDefault()
      void send()
    }

    if (event.key.toLowerCase() === 's') {
      event.preventDefault()
      options.openCommitModal()
    }

    if (event.key.toLowerCase() === 'b') {
      event.preventDefault()
      options.openBranchModal()
    }
  }

  onBeforeUnmount(() => {
    streamAbort?.abort()
    streamAbort = null
  })

  return {
    input,
    streaming,
    send,
    onInputKeydown,
  }
}
