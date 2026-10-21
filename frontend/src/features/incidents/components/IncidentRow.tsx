import { Clock } from 'lucide-react'

import type { Incident } from '@/api/types'
import { cn } from '@/lib/utils'

import { CATEGORY, CRITICALITY, STATUS } from '../constants'
import { formatDateTime, formatElapsed, formatLocation, isOverSla, minutesSince } from '../format'

interface IncidentRowProps {
  incident: Incident
  now: number
}

/** Alta + vítimas + ninguém assumiu: o caso que não pode esperar. */
function isUrgent(incident: Incident): boolean {
  return (
    incident.status === 'OPEN' &&
    incident.criticality === 'HIGH' &&
    incident.category === 'ACCIDENT_WITH_VICTIMS'
  )
}

export function IncidentRow({ incident, now }: IncidentRowProps) {
  const criticality = CRITICALITY[incident.criticality]
  const category = CATEGORY[incident.category]
  const status = STATUS[incident.status]
  const CriticalityIcon = criticality.icon
  const CategoryIcon = category.icon
  const overSla = isOverSla(incident, now)
  const urgent = isUrgent(incident)

  return (
    <li className="relative flex rounded-lg border bg-card transition-colors hover:bg-muted/40">
      {/* Barra lateral: a criticidade percebida antes mesmo de ler. */}
      <span aria-hidden className={cn('w-1 shrink-0 rounded-l-lg', criticality.bar)} />

      <div className="grid min-w-0 flex-1 items-center gap-x-4 gap-y-1.5 px-3 py-2 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]">
        <div className={cn('flex items-center gap-1.5 text-sm font-semibold', criticality.text)}>
          <CriticalityIcon className="size-4" aria-hidden />
          {criticality.label}
          {urgent && (
            <span className="relative ml-0.5 flex size-2" title="Alta, com vítimas e sem responsável">
              <span className="absolute inline-flex size-full rounded-full bg-critical-high opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2 rounded-full bg-critical-high" />
              <span className="sr-only">Urgente</span>
            </span>
          )}
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <CategoryIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{incident.title}</span>
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {category.label} · {formatLocation(incident)} · {incident.city}/{incident.state} ·{' '}
            <span className="font-mono text-xs">{incident.vehicle_plate}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm sm:flex-col sm:items-end">
          <span className="flex items-center gap-2">
            <span className={cn('rounded-md border px-1.5 py-0.5 text-xs font-medium', status.badge)}>
              {status.label}
            </span>
            <span className="text-muted-foreground">
              {incident.assigned_to?.name ?? 'Sem responsável'}
            </span>
          </span>
          <time
            dateTime={incident.reported_at}
            title={`Reportado em ${formatDateTime(incident.reported_at)}`}
            className={cn(
              'flex items-center gap-1 tabular-nums',
              overSla ? 'font-medium text-critical-high' : 'text-muted-foreground',
            )}
          >
            <Clock className="size-3.5" aria-hidden />
            {formatElapsed(minutesSince(incident.reported_at, now))}
            {overSla && <span>· acima do SLA</span>}
          </time>
        </div>
      </div>
    </li>
  )
}
