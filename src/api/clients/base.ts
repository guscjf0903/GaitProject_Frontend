import { ApiError, OpenAPI } from '../generated'

type ApiEnvelope<T> = {
  code: string
  message: string
  data?: T | null
}

export function requireData<T>(data: T | null | undefined, message: string): T {
  if (data == null) {
    throw new Error(message)
  }
  return data
}

export function extractApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    const body = error.body as { message?: string } | string | undefined
    if (typeof body === 'string' && body.trim()) return body
    if (body && typeof body === 'object' && typeof body.message === 'string' && body.message.trim()) {
      return body.message
    }
    return `${error.status} ${error.statusText}`.trim() || fallback
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

function buildHeaders(init: RequestInit): HeadersInit {
  const token = localStorage.getItem('gait_access_token')
  const hasBody = init.body != null

  return {
    Accept: 'application/json',
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  }
}

export async function apiFetchData<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${OpenAPI.BASE || 'http://localhost:8080'}${path}`, {
    ...init,
    headers: buildHeaders(init),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!response.ok) {
    if (isJson) {
      const body = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null
      throw new Error(body?.message || `Request failed: ${response.status}`)
    }

    const text = await response.text().catch(() => '')
    throw new Error(text || `Request failed: ${response.status}`)
  }

  if (!isJson) {
    throw new Error('Expected JSON response')
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  return requireData(payload.data, payload.message || 'Response data is missing')
}
