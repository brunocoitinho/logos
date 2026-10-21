import { CheckCircle2, CirclePlus, Hand, Pencil, RotateCcw, Trash2, Undo2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { IncidentEvent, IncidentEventType } from '@/api/types'
import { Skeleton } from '@/components/ui/skeleton'

import { STATUS } from '../constants'
import { formatDateTime } from '../format'

const EVENT: Record<IncidentEventType, { icon: LucideIcon; label: (event: IncidentEvent) => string }> = {
  CREATED: { icon: CirclePlus, label: () => 'Registrou o incidente' },
  CLAIMED: { icon: Hand, label: () => 'Assumiu o incidente' },
  RELEASED: { icon: Undo2, label: () => 'Devolveu à fila' },
  STATUS_CHANGED: {
    icon: CheckCircle2,
    label: (event) => `Mudou para ${event.to_status ? STATUS[event.to_status].label : 'outro status'}`,
  },
  REOPENED: { icon: RotateCcw, label: () => 'Reabriu o incidente' },
  UPDATED: { icon: Pencil, label: () => 'Editou o incidente' },
  DELETED: { icon: Trash2, label: () => 'Excluiu o incidente' },
}

interface IncidentTimelineProps {
  events: IncidentEvent[] | undefined
  isPending: boolean
}

export function IncidentTimeline({ events, isPending }: IncidentTimelineProps) {
  if (isPending) {
    return (
      <div className="space-y-3" role="status" aria-label="Carregando histórico">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  if (!events?.length) {
    return <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
  }

  return (
    <ol aria-label="Histórico do incidente" className="space-y-3">
      {[...events].reverse().map((event) => {
        const { icon: Icon, label } = EVENT[event.type]
        return (
          <li key={event.id} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className="size-3.5 text-muted-foreground" aria-hidden />
            </span>
            <div className="min-w-0">
              <p>
                <span className="font-medium">{event.user?.name ?? 'Sistema'}</span>{' '}
                <span className="text-muted-foreground">{label(event).toLowerCase()}</span>
              </p>
              <time dateTime={event.created_at} className="text-xs text-muted-foreground">
                {formatDateTime(event.created_at)}
              </time>
              {event.note && (
                <p className="mt-1 rounded-md bg-muted/50 px-2 py-1.5 text-sm whitespace-pre-wrap">
                  {event.note}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
