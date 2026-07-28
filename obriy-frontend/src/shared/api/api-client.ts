import { API_BASE_URL } from '../config/env'

interface ApiErrorPayload {
  statusCode?: number
  code?: string
  email?: string
  message?: string | string[]
  retryAfterSeconds?: number
}

interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  accessToken?: string | null
  body?: unknown
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly email?: string
  readonly retryAfterSeconds?: number

  constructor(
    status: number,
    code: string,
    message: string,
    retryAfterSeconds?: number,
    email?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
    this.email = email
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { accessToken, body, headers: providedHeaders, ...requestInit } = options
  const headers = new Headers(providedHeaders)

  headers.set('Accept', 'application/json')
  headers.set('Accept-Language', getRequestLanguage())

  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestInit,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      headers,
    })
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Could not connect to the Obriy API.',
    )
  }

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw createApiError(response.status, payload)
  }

  return payload as T
}

function getRequestLanguage(): 'en' | 'uk' {
  return localStorage.getItem('obriy-language') === 'en' ? 'en' : 'uk'
}

async function readResponsePayload(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const contentType = response.headers.get('content-type')
  if (!contentType?.includes('application/json')) {
    return undefined
  }

  return response.json()
}

function createApiError(status: number, payload: unknown): ApiError {
  if (!isApiErrorPayload(payload)) {
    return new ApiError(status, 'UNEXPECTED_API_ERROR', 'Unexpected API error.')
  }

  const message = Array.isArray(payload.message)
    ? payload.message.join('. ')
    : payload.message || 'Unexpected API error.'

  return new ApiError(
    status,
    payload.code || 'UNEXPECTED_API_ERROR',
    message,
    payload.retryAfterSeconds,
    payload.email,
  )
}

function isApiErrorPayload(payload: unknown): payload is ApiErrorPayload {
  return typeof payload === 'object' && payload !== null
}
