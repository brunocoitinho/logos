import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

import { claimIncident, releaseIncident, transitionIncident } from '@/api/incidents'
import type { ApiError } from '@/api/errors'
import type { Incident, IncidentList, IncidentStatus, User } from '@/api/types'
import { useAuth } from '@/features/auth/auth-context'

import { incidentKeys } from './queries'

export type IncidentAction =
  | { type: 'claim' }
  | { type: 'release'; note?: string }
  | { type: 'transition'; toStatus: IncidentStatus; note: string }

interface MutationContext {
  snapshots: [QueryKey, unknown][]
}

function runAction(incident: Incident, action: IncidentAction): Promise<Incident> {
  switch (action.type) {
    case 'claim':
      return claimIncident(incident.id)
    case 'release':
      return releaseIncident(incident.id, { version: incident.version, note: action.note })
    case 'transition':
      return transitionIncident(incident.id, {
        version: incident.version,
        to_status: action.toStatus,
        note: action.note,
      })
  }
}

/** Como o incidente deve ficar se o servidor aceitar a ação (o que a tela mostra na hora). */
export function predictResult(incident: Incident, action: IncidentAction, user: User): Incident {
  const now = new Date().toISOString()
  switch (action.type) {
    case 'claim':
      return {
        ...incident,
        status: 'INVESTIGATING',
        assigned_to: { id: user.id, name: user.name },
        assigned_at: now,
      }
    case 'release':
      return { ...incident, status: 'OPEN', assigned_to: null, assigned_at: null }
    case 'transition':
      return action.toStatus === 'OPEN'
        ? {
            ...incident,
            status: 'OPEN',
            assigned_to: null,
            assigned_at: null,
            resolution_note: null,
          }
        : { ...incident, status: action.toStatus, resolution_note: action.note }
  }
}

export function successMessage(action: IncidentAction): string {
  if (action.type === 'claim') return 'Incidente assumido. Você é o responsável.'
  if (action.type === 'release') return 'Incidente devolvido à fila.'
  if (action.toStatus === 'CLOSED') return 'Incidente fechado.'
  if (action.toStatus === 'INCONCLUSIVE') return 'Incidente marcado como inconclusivo.'
  return 'Incidente reaberto.'
}

/** Grava a versão do incidente no detalhe e em todas as listas em cache que o contêm. */
function writeIncident(queryClient: QueryClient, incident: Incident) {
  queryClient.setQueryData(incidentKeys.detail(incident.id), incident)
  queryClient.setQueriesData<IncidentList>({ queryKey: incidentKeys.lists() }, (list) =>
    list
      ? { ...list, items: list.items.map((item) => (item.id === incident.id ? incident : item)) }
      : list,
  )
}

/**
 * Ações do ciclo de vida com atualização otimista:
 *
 * 1. onMutate:  pausa as atualizações automáticas, guarda o estado atual (snapshot) e já
 *               mostra o resultado esperado: o analista vê a resposta na hora.
 * 2. onError:   desfaz (volta ao snapshot). Se foi conflito (409), a API devolve o estado
 *               real do incidente, que entra direto na tela, com a mensagem de quem agiu antes.
 * 3. onSuccess: troca a previsão pela versão confirmada pelo servidor.
 * 4. onSettled: recarrega lista, contadores e histórico para alinhar tudo com o servidor.
 */
export function useIncidentAction(incident: Incident | undefined) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation<Incident, ApiError, IncidentAction, MutationContext>({
    mutationFn: (action) => runAction(incident!, action),

    onMutate: async (action) => {
      // Uma atualização automática chegando agora apagaria a previsão otimista.
      await queryClient.cancelQueries({ queryKey: incidentKeys.all })
      const snapshots = queryClient.getQueriesData({ queryKey: incidentKeys.all })
      if (incident && user) writeIncident(queryClient, predictResult(incident, action, user))
      return { snapshots }
    },

    onError: (error, _action, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))

      const current = error.details?.current as Incident | undefined
      if (error.isConflict && current) {
        writeIncident(queryClient, current)
        toast.error('Outro analista agiu antes', { description: error.message })
      } else {
        toast.error('Não foi possível concluir a ação', { description: error.message })
      }
    },

    onSuccess: (updated, action) => {
      writeIncident(queryClient, updated)
      toast.success(successMessage(action))
    },

    onSettled: () => queryClient.invalidateQueries({ queryKey: incidentKeys.all }),
  })
}
