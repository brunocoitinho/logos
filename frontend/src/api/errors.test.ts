import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { apiError, apiUrl, server } from '@/test/server'

import { api } from './client'
import { ApiError } from './errors'

async function requestError(): Promise<ApiError> {
  try {
    await api.get('/incidents')
  } catch (error) {
    return error as ApiError
  }
  throw new Error('a requisição deveria ter falhado')
}

describe('normalização de erros da API', () => {
  it('lê o formato padrão de erro da API', async () => {
    server.use(
      http.get(apiUrl('/incidents'), () =>
        HttpResponse.json(
          {
            error: {
              code: 'CONFLICT',
              message: 'Ana Souza assumiu este incidente antes de você.',
              details: { current: { id: 7 } },
            },
          },
          { status: 409 },
        ),
      ),
    )

    const error = await requestError()

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(409)
    expect(error.isConflict).toBe(true)
    expect(error.message).toBe('Ana Souza assumiu este incidente antes de você.')
    expect(error.details).toEqual({ current: { id: 7 } })
  })

  it('transforma queda de rede em erro sem status e com mensagem clara', async () => {
    server.use(http.get(apiUrl('/incidents'), () => HttpResponse.error()))

    const error = await requestError()

    expect(error.isNetworkError).toBe(true)
    expect(error.code).toBe('NETWORK_ERROR')
    expect(error.message).toMatch(/sem conexão/i)
  })

  it('usa mensagem genérica quando a resposta não segue o formato padrão', async () => {
    server.use(http.get(apiUrl('/incidents'), () => new HttpResponse('Bad Gateway', { status: 502 })))

    const error = await requestError()

    expect(error.status).toBe(502)
    expect(error.message).toBe('Erro inesperado. Tente novamente.')
  })

  it('envia o token salvo no cabeçalho Authorization', async () => {
    localStorage.setItem('logos.token', 'meu-token')
    let authorization: string | null = null
    server.use(
      http.get(apiUrl('/incidents'), ({ request }) => {
        authorization = request.headers.get('Authorization')
        return apiError(500, 'X', 'fim do teste')
      }),
    )

    await requestError()

    expect(authorization).toBe('Bearer meu-token')
  })
})
