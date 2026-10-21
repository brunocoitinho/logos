import { api } from './client'
import type {
  Criticality,
  IncidentCategory,
  IncidentList,
  IncidentStatus,
  IncidentSummary,
} from './types'

export interface IncidentListParams {
  status: IncidentStatus[]
  criticality: Criticality[]
  category: IncidentCategory[]
  q?: string
  limit: number
  offset: number
}

export async function listIncidents(
  params: IncidentListParams,
  signal?: AbortSignal,
): Promise<IncidentList> {
  const { data } = await api.get<IncidentList>('/incidents', {
    // Busca vazia não é enviada (a API recusaria q com tamanho zero).
    params: { ...params, q: params.q || undefined },
    signal,
  })
  return data
}

export async function getIncidentSummary(signal?: AbortSignal): Promise<IncidentSummary> {
  const { data } = await api.get<IncidentSummary>('/incidents/summary', { signal })
  return data
}
