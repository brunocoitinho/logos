import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api/errors'

import { retryDelay, shouldRetry } from './query-client'

describe('política de novas tentativas', () => {
  it.each([
    ['falha de rede', new ApiError('Sem conexão', 'NETWORK_ERROR', null)],
    ['erro do servidor', new ApiError('Erro', 'INTERNAL_ERROR', 500)],
    ['banco indisponível', new ApiError('Indisponível', 'SERVICE_UNAVAILABLE', 503)],
  ])('repete em %s', (_, error) => {
    expect(shouldRetry(0, error)).toBe(true)
  })

  it.each([
    ['validação', 422],
    ['conflito', 409],
    ['sem permissão', 403],
    ['não encontrado', 404],
  ])('não repete em %s (%i): a resposta seria a mesma', (_, status) => {
    expect(shouldRetry(0, new ApiError('Erro', 'X', status))).toBe(false)
  })

  it('desiste depois de 3 tentativas', () => {
    const networkError = new ApiError('Sem conexão', 'NETWORK_ERROR', null)

    expect(shouldRetry(2, networkError)).toBe(true)
    expect(shouldRetry(3, networkError)).toBe(false)
  })

  it('espera cada vez mais entre tentativas, até 8 s', () => {
    expect([0, 1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 8000, 8000])
  })
})
