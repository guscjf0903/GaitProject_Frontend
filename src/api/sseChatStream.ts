export type SseFrame = {
  event?: string
  data?: string
  id?: string
}

export type SseHandlers = {
  onEvent?: (frame: SseFrame) => void
  onChunk?: (payload: any) => void
  onDone?: (payload?: any) => void
  onError?: (payload?: any) => void
  onRagStatus?: (payload?: any) => void
}

/**
 * POST + text/event-stream SSE reader.
 *
 * Backend: POST /api/chat/stream
 * - event: ANSWER_CHUNK (multiple)
 * - event: ANSWER_DONE (once)
 * - data: JSON(ApiResponse.ok(SseEvent(...)))
 */
export async function streamChatSse(options: {
  url: string
  token?: string | null
  body: any
  signal?: AbortSignal
  handlers?: SseHandlers
}) {
  const res = await fetch(options.url, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(options.body),
    signal: options.signal,
  })

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '')
    throw new Error(`SSE failed: ${res.status} ${res.statusText} ${text}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')

  let buffer = ''
  let current: SseFrame = {}
  let terminalReceived = false

  const emit = (frame: SseFrame) => {
    options.handlers?.onEvent?.(frame)

    const ev = frame.event?.trim()
    if (!ev || frame.data == null) return

    if (ev === 'ANSWER_CHUNK') {
      try {
        options.handlers?.onChunk?.(JSON.parse(frame.data))
      } catch {
        // ignore parse errors; caller can inspect raw frame via onEvent
      }
    }
    if (ev === 'ANSWER_DONE') {
      terminalReceived = true
      try {
        options.handlers?.onDone?.(JSON.parse(frame.data))
      } catch {
        options.handlers?.onDone?.()
      }
    }
    if (ev === 'RAG_STATUS') {
      try {
        options.handlers?.onRagStatus?.(JSON.parse(frame.data))
      } catch {
        options.handlers?.onRagStatus?.()
      }
    }
    if (ev === 'ANSWER_ERROR') {
      terminalReceived = true
      try {
        options.handlers?.onError?.(JSON.parse(frame.data))
      } catch {
        options.handlers?.onError?.()
      }
    }
  }

  while (true) {
    let value: Uint8Array | undefined
    let done = false
    try {
      const r = await reader.read()
      value = r.value
      done = r.done
    } catch (e) {
      // 브라우저가 스트림 종료를 네트워크 에러로 보고하는 경우가 있어,
      // 이미 DONE/ERROR를 받았다면 이를 정상 종료로 간주합니다.
      if (terminalReceived) break
      throw e
    }

    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE is line-oriented. Events separated by a blank line.
    let idx: number
    while ((idx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)

      if (line.endsWith('\r')) line = line.slice(0, -1)

      if (line === '') {
        // dispatch event
        if (current.event || current.data || current.id) {
          emit(current)
        }
        current = {}
        continue
      }

      // ignore comments
      if (line.startsWith(':')) continue

      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      let valuePart = colon === -1 ? '' : line.slice(colon + 1)
      if (valuePart.startsWith(' ')) valuePart = valuePart.slice(1)

      switch (field) {
        case 'event':
          current.event = valuePart
          break
        case 'data':
          current.data = (current.data ? current.data + '\n' : '') + valuePart
          break
        case 'id':
          current.id = valuePart
          break
        default:
          break
      }
    }
  }

  // 스트림이 끝났는데 마지막 빈 줄이 오지 않아 이벤트가 디스패치되지 않는 경우 보강
  if (current.event || current.data || current.id) {
    emit(current)
  }
}

