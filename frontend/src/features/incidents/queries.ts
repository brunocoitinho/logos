import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'

import { getIncident, getIncidentSummary, listIncidentEvents, listIncidents } from '@/api/incidents'
import type { IncidentListParams } from '@/api/incidents'
import type { ApiError } from '@/api/errors'
import type { Incident, IncidentEvent, IncidentList, IncidentSummary } from '@/api/types'

import { PAGE_SIZE, REFRESH_INTERVAL_MS } from './constants'
import type { IncidentFilters } from './use-incident-filters'

export const incidentKeys = {
  all: ['incidents'] as const,
  lists: () => [...incidentKeys.all, 'list'] as const,
  list: (params: IncidentListParams) => [...incidentKeys.lists(), params] as const,
  summary: () => [...incidentKeys.all, 'summary'] as const,
  detail: (id: number) => [...incidentKeys.all, 'detail', id] as const,
  events: (id: number) => [...incidentKeys.all, 'events', id] as const,
}

export function toListParams(filters: IncidentFilters): IncidentListParams {
  return {
    status: filters.status,
    criticality: filters.criticality,
    category: filters.category,
    q: filters.q,
    limit: PAGE_SIZE,
    offset: filters.offset,
  }
}

export function useIncidentList(filters: IncidentFilters) {
  const params = toListParams(filters)
  return useQuery<IncidentList, ApiError>({
    queryKey: incidentKeys.list(params),
    queryFn: ({ signal }) => listIncidents(params, signal),
    // Ao trocar de filtro, a lista anterior continua na tela até a nova chegar: sem piscar.
    placeholderData: keepPreviousData,
    // Atualização automática: o trabalho dos outros analistas aparece sem recarregar a página.
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function useIncidentSummary() {
  return useQuery<IncidentSummary, ApiError>({
    queryKey: incidentKeys.summary(),
    queryFn: ({ signal }) => getIncidentSummary(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function useIncident(id: number | null, active = true) {
  const queryClient = useQueryClient()
  return useQuery<Incident, ApiError>({
    queryKey: incidentKeys.detail(id ?? 0),
    queryFn: ({ signal }) => getIncident(id!, signal),
    enabled: active && id !== null,
    // A gaveta abre na hora com o que já está na lista; os dados completos chegam em seguida.
    placeholderData: () => findInLists(queryClient.getQueriesData<IncidentList>({ queryKey: incidentKeys.lists() }), id),
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

export function useIncidentEvents(id: number | null, active = true) {
  return useQuery<IncidentEvent[], ApiError>({
    queryKey: incidentKeys.events(id ?? 0),
    queryFn: ({ signal }) => listIncidentEvents(id!, signal),
    enabled: active && id !== null,
    refetchInterval: REFRESH_INTERVAL_MS,
  })
}

function findInLists(
  lists: [unknown, IncidentList | undefined][],
  id: number | null,
): Incident | undefined {
  for (const [, list] of lists) {
    const found = list?.items.find((incident) => incident.id === id)
    if (found) return found
  }
  return undefined
}
