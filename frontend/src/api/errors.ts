import axios from 'axios'

import type { ApiErrorBody } from './types'

/**
 * Erro normalizado: a UI trata qualquer falha (resposta da API, queda de rede, timeout)
 * pelo mesmo formato, sem conhecer detalhes do Axios.
 */
export class ApiError extends Error {
  readonly status: number | null
  readonly code: string
  readonly details: Record<string, unknown> | undefined

  constructor(
    message: string,
    code: string,
    status: number | null,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }

  /** Falha sem resposta do servidor: sem internet, servidor fora ou timeout. */
  get isNetworkError(): boolean {
    return this.status === null
  }

  get isConflict(): boolean {
    return this.status === 409
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
      return new ApiError(
        timedOut
          ? 'O servidor demorou para responder. Tente novamente.'
          : 'Sem conexão com o servidor. Verifique sua internet.',
        timedOut ? 'TIMEOUT' : 'NETWORK_ERROR',
        null,
      )
    }

    const body = error.response.data?.error
    return new ApiError(
      body?.message ?? 'Erro inesperado. Tente novamente.',
      body?.code ?? 'HTTP_ERROR',
      error.response.status,
      body?.details,
    )
  }

  return new ApiError('Erro inesperado. Tente novamente.', 'UNKNOWN', null)
}
