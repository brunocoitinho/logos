import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { createIncident, deleteIncident, updateIncident } from '@/api/incidents'
import type { IncidentInput } from '@/api/incidents'
import type { ApiError } from '@/api/errors'
import type { Incident } from '@/api/types'

import { refreshIncidents, writeIncident } from '../cache'

/** Em conflito (409), a API devolve o estado atual: ele entra na tela no lugar do antigo. */
function applyConflict(queryClient: ReturnType<typeof useQueryClient>, error: ApiError): boolean {
  const current = error.details?.current as Incident | undefined
  if (!error.isConflict || !current) return false
  writeIncident(queryClient, current)
  toast.error('Outro analista alterou este incidente', { description: error.message })
  return true
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation<Incident, ApiError, { input: IncidentInput; idempotencyKey: string }>({
    mutationFn: ({ input, idempotencyKey }) => createIncident(input, idempotencyKey),
    onSuccess: () => {
      toast.success('Incidente registrado.')
      void refreshIncidents(queryClient)
    },
  })
}

export function useUpdateIncident(incident: Incident) {
  const queryClient = useQueryClient()
  return useMutation<Incident, ApiError, Partial<IncidentInput>>({
    mutationFn: (changes) => updateIncident(incident.id, { ...changes, version: incident.version }),
    onSuccess: (updated) => {
      writeIncident(queryClient, updated)
      toast.success('Alterações salvas.')
      void refreshIncidents(queryClient)
    },
    onError: (error) => {
      if (applyConflict(queryClient, error)) void refreshIncidents(queryClient)
    },
  })
}

export function useDeleteIncident(incident: Incident) {
  const queryClient = useQueryClient()
  return useMutation<void, ApiError, void>({
    mutationFn: () => deleteIncident(incident.id, incident.version),
    onSuccess: () => {
      toast.success('Incidente excluído.')
      void refreshIncidents(queryClient)
    },
    onError: (error) => {
      if (!applyConflict(queryClient, error)) {
        toast.error('Não foi possível excluir', { description: error.message })
      }
    },
  })
}
