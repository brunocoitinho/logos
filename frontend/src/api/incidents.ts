import { api } from './client'
import type {
  Criticality,
  Incident,
  IncidentCategory,
  IncidentEvent,
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

export async function getIncident(id: number, signal?: AbortSignal): Promise<Incident> {
  const { data } = await api.get<Incident>(`/incidents/${id}`, { signal })
  return data
}

export async function listIncidentEvents(id: number, signal?: AbortSignal): Promise<IncidentEvent[]> {
  const { data } = await api.get<IncidentEvent[]>(`/incidents/${id}/events`, { signal })
  return data
}

/** Assumir não envia versão: a API usa o próprio estado (Aberto e sem responsável) como trava. */
export async function claimIncident(id: number): Promise<Incident> {
  const { data } = await api.post<Incident>(`/incidents/${id}/claim`)
  return data
}

export async function releaseIncident(
  id: number,
  body: { version: number; note?: string },
): Promise<Incident> {
  const { data } = await api.post<Incident>(`/incidents/${id}/release`, body)
  return data
}

export async function transitionIncident(
  id: number,
  body: { version: number; to_status: IncidentStatus; note: string },
): Promise<Incident> {
  const { data } = await api.post<Incident>(`/incidents/${id}/transition`, body)
  return data
}
