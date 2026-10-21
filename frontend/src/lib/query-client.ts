import { QueryClient } from '@tanstack/react-query'

import { ApiError } from '@/api/errors'

const MAX_RETRIES = 3

/**
 * Repete só o que pode dar certo na próxima tentativa:
 * - falha de rede, timeout e erros 5xx (servidor ou banco oscilando): repete;
 * - erros 4xx (validação, conflito, sem permissão): não repete, a resposta seria a mesma.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false
  if (error instanceof ApiError && error.status !== null && error.status < 500) return false
  return true
}

/** Espera crescente entre tentativas (1 s, 2 s, 4 s...), limitada a 8 s. */
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        retryDelay,
        // Dados com até 5 s são considerados atuais: navegar entre telas não refaz a busca.
        staleTime: 5_000,
        // Ao voltar para a aba, recarrega: o analista vê o que mudou enquanto esteve fora.
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Escritas não são repetidas automaticamente: repetir um "assumir" ou "fechar"
        // poderia duplicar a ação. O usuário decide tentar de novo.
        retry: false,
      },
    },
  })
}
