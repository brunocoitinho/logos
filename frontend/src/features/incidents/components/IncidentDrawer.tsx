import { AlertTriangle, Pencil } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { CATEGORY, CRITICALITY, STATUS } from '../constants'
import { DeleteIncidentButton } from '../form/DeleteIncidentButton'
import { IncidentFormSheet } from '../form/IncidentFormSheet'
import { formatDateTime, formatLocation } from '../format'
import { useIncident, useIncidentEvents } from '../queries'
import { IncidentActions } from './IncidentActions'
import { IncidentTimeline } from './IncidentTimeline'

interface IncidentDrawerProps {
  incidentId: number | null
  onClose: () => void
}

export function IncidentDrawer({ incidentId, onClose }: IncidentDrawerProps) {
  const isOpen = incidentId !== null
  // Ao fechar, o painel desliza para fora ainda mostrando o último incidente (sem isso, o
  // conteúdo virava "Carregando..." durante a animação). As consultas param ao fechar.
  const [displayedId, setDisplayedId] = useState(incidentId)
  if (incidentId !== null && incidentId !== displayedId) setDisplayedId(incidentId)

  const incident = useIncident(displayedId, isOpen)
  const events = useIncidentEvents(displayedId, isOpen)
  const data = incident.data
  const [editing, setEditing] = useState(false)

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {!data ? (
          <DrawerFallback
            isPending={incident.isPending}
            message={incident.error?.message}
            onRetry={() => void incident.refetch()}
          />
        ) : (
          <>
            <SheetHeader className="border-b">
              <CriticalityLine criticality={data.criticality} category={data.category} />
              <SheetTitle className="text-lg">{data.title}</SheetTitle>
              <SheetDescription>
                {formatLocation(data)} · {data.city}/{data.state}
              </SheetDescription>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil aria-hidden /> Editar
                </Button>
                <DeleteIncidentButton incident={data} onDeleted={onClose} />
              </div>
            </SheetHeader>

            <IncidentFormSheet
              open={editing}
              onOpenChange={setEditing}
              form={{ mode: 'edit', incident: data, onDone: () => setEditing(false) }}
            />

            <div className="space-y-6 p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <Field label="Status">
                  <span className={cn('rounded-md border px-1.5 py-0.5 text-xs font-medium', STATUS[data.status].badge)}>
                    {STATUS[data.status].label}
                  </span>
                </Field>
                <Field label="Responsável">{data.assigned_to?.name ?? 'Ninguém ainda'}</Field>
                <Field label="Reportado em">{formatDateTime(data.reported_at)}</Field>
                <Field label="Placa">
                  <span className="font-mono">{data.vehicle_plate}</span>
                </Field>
                {data.description && (
                  <Field label="Descrição" wide>
                    {data.description}
                  </Field>
                )}
                {data.resolution_note && (
                  <Field label="Nota de resolução" wide>
                    {data.resolution_note}
                  </Field>
                )}
              </dl>

              <section aria-labelledby="actions-title" className="space-y-3">
                <h3 id="actions-title" className="text-sm font-semibold">
                  Ações
                </h3>
                {/* key: trocar de incidente ou de status limpa a nota digitada. */}
                <IncidentActions key={`${data.id}-${data.status}`} incident={data} />
              </section>

              <section aria-labelledby="timeline-title" className="space-y-3">
                <h3 id="timeline-title" className="text-sm font-semibold">
                  Histórico
                </h3>
                <IncidentTimeline events={events.data} isPending={events.isPending} />
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function CriticalityLine({
  criticality,
  category,
}: {
  criticality: keyof typeof CRITICALITY
  category: keyof typeof CATEGORY
}) {
  const CriticalityIcon = CRITICALITY[criticality].icon
  const CategoryIcon = CATEGORY[category].icon
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className={cn('flex items-center gap-1.5 font-semibold', CRITICALITY[criticality].text)}>
        <CriticalityIcon className="size-4" aria-hidden />
        Criticidade {CRITICALITY[criticality].label.toLowerCase()}
      </span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <CategoryIcon className="size-4" aria-hidden />
        {CATEGORY[category].label}
      </span>
    </p>
  )
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('space-y-0.5', wide && 'col-span-2')}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{children}</dd>
    </div>
  )
}

function DrawerFallback({
  isPending,
  message,
  onRetry,
}: {
  isPending: boolean
  message: string | undefined
  onRetry: () => void
}) {
  return (
    <>
      {/* Título acessível obrigatório no diálogo, mesmo enquanto carrega. */}
      <SheetHeader>
        <SheetTitle>{isPending ? 'Carregando incidente' : 'Incidente indisponível'}</SheetTitle>
        <SheetDescription className="sr-only">Detalhe do incidente</SheetDescription>
      </SheetHeader>
      {isPending ? (
        <div className="space-y-3 p-4" role="status" aria-label="Carregando incidente">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
          <AlertTriangle className="size-8 text-destructive" aria-hidden />
          <p className="text-sm text-muted-foreground">{message}</p>
          <Button onClick={onRetry}>Tentar novamente</Button>
        </div>
      )}
    </>
  )
}
