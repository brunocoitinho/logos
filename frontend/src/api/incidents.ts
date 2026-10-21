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

export interface IncidentInput {
  title: string
  description: string | null
  category: IncidentCategory
  criticality: Criticality
  vehicle_plate: string
  highway: string
  km: number
  city: string
  state: string
}

/**
 * A chave de idempotência acompanha o formulário: se a rede falhar e o analista enviar de
 * novo, a API devolve o incidente já criado em vez de duplicá-lo.
 */
export async function createIncident(body: IncidentInput, idempotencyKey: string): Promise<Incident> {
  const { data } = await api.post<Incident>('/incidents', body, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
  return data
}

/** Envia só os campos alterados, com a versão lida (a API devolve 409 se ficou desatualizada). */
export async function updateIncident(
  id: number,
  body: Partial<IncidentInput> & { version: number },
): Promise<Incident> {
  const { data } = await api.patch<Incident>(`/incidents/${id}`, body)
  return data
}

export async function deleteIncident(id: number, version: number): Promise<void> {
  await api.delete(`/incidents/${id}`, { params: { version } })
}
