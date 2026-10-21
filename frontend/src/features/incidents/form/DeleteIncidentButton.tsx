import { Loader2, Trash2 } from 'lucide-react'

import type { Incident } from '@/api/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useOnline } from '@/lib/use-online'

import { useDeleteIncident } from './use-incident-mutations'

interface DeleteIncidentButtonProps {
  incident: Incident
  onDeleted: () => void
}

export function DeleteIncidentButton({ incident, onDeleted }: DeleteIncidentButtonProps) {
  const online = useOnline()
  const remove = useDeleteIncident(incident)

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={!online || remove.isPending}>
          {remove.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
          Excluir
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este incidente?</AlertDialogTitle>
          <AlertDialogDescription>
            "{incident.title}" sai da fila e dos contadores. O histórico fica guardado para auditoria.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => remove.mutate(undefined, { onSuccess: onDeleted })}
          >
            Excluir incidente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
