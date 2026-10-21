import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { getIncidentSummary, listIncidents } from '@/api/incidents'
import type { IncidentListParams } from '@/api/incidents'
import type { ApiError } from '@/api/errors'
import type { IncidentList, IncidentSummary } from '@/api/types'

import { PAGE_SIZE, REFRESH_INTERVAL_MS } from './constants'
import type { IncidentFilters } from './use-incident-filters'

export const incidentKeys = {
  all: ['incidents'] as const,
  lists: () => [...incidentKeys.all, 'list'] as const,
  list: (params: IncidentListParams) => [...incidentKeys.lists(), params] as const,
  summary: () => [...incidentKeys.all, 'summary'] as const,
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
