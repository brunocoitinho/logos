import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import type { IncidentList, IncidentSummary, User } from '@/api/types'
import { API_URL } from '@/lib/env'

/**
 * MSW intercepta as requisições na camada de rede: o teste exercita o código real
 * (Axios + TanStack Query + interceptors) e só a "resposta do servidor" é simulada.
 */
export const apiUrl = (path: string) => `${API_URL}/api${path}`

export const testUser: User = { id: 1, name: 'Ana Souza', email: 'ana@logos.demo' }

export const emptyList: IncidentList = { items: [], total: 0, limit: 100, offset: 0 }

export const emptySummary: IncidentSummary = {
  by_status: { OPEN: 0, INVESTIGATING: 0, CLOSED: 0, INCONCLUSIVE: 0 },
  open_by_criticality: { HIGH: 0, MEDIUM: 0, LOW: 0 },
  investigating_by_criticality: { HIGH: 0, MEDIUM: 0, LOW: 0 },
}

export const defaultHandlers = [
  http.get(apiUrl('/auth/me'), () => HttpResponse.json(testUser)),
  http.get(apiUrl('/incidents'), () => HttpResponse.json(emptyList)),
  http.get(apiUrl('/incidents/summary'), () => HttpResponse.json(emptySummary)),
]

export const server = setupServer(...defaultHandlers)

/** Resposta de erro no formato padrão da API. */
export function apiError(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status })
}
