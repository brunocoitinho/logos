import type { QueryClient } from '@tanstack/react-query'

import type { Incident, IncidentList } from '@/api/types'

import { incidentKeys } from './queries'

/** Grava a versão do incidente no detalhe e em todas as listas em cache que o contêm. */
export function writeIncident(queryClient: QueryClient, incident: Incident) {
  queryClient.setQueryData(incidentKeys.detail(incident.id), incident)
  queryClient.setQueriesData<IncidentList>({ queryKey: incidentKeys.lists() }, (list) =>
    list
      ? { ...list, items: list.items.map((item) => (item.id === incident.id ? incident : item)) }
      : list,
  )
}

/** Recarrega lista, contadores, detalhe e histórico para alinhar tudo com o servidor. */
export function refreshIncidents(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: incidentKeys.all })
}
