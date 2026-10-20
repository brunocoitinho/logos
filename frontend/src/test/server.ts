import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import type { User } from '@/api/types'
import { API_URL } from '@/lib/env'

/**
 * MSW intercepta as requisições na camada de rede: o teste exercita o código real
 * (Axios + TanStack Query + interceptors) e só a "resposta do servidor" é simulada.
 */
export const apiUrl = (path: string) => `${API_URL}/api${path}`

export const testUser: User = { id: 1, name: 'Ana Souza', email: 'ana@logos.demo' }

export const defaultHandlers = [http.get(apiUrl('/auth/me'), () => HttpResponse.json(testUser))]

export const server = setupServer(...defaultHandlers)

/** Resposta de erro no formato padrão da API. */
export function apiError(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status })
}
