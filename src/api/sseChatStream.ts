export type SseFrame = {
  event?: string
  data?: string
  id?: string
}

export type SseHandlers = {
  onEvent?: (frame: SseFrame) => void
  onChunk?: (payload: any) => void
  onDone?: (payload?: any) => void
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
      try {
        options.handlers?.onDone?.(JSON.parse(frame.data))
      } catch {
        options.handlers?.onDone?.()
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read()
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
}

