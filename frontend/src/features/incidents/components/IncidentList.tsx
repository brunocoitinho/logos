import { AlertTriangle, CheckCircle2, RotateCw, SearchX } from 'lucide-react'

import type { ApiError } from '@/api/errors'
import type { IncidentList as IncidentListData } from '@/api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useNow } from '@/lib/use-now'

import { PAGE_SIZE } from '../constants'
import { formatTime } from '../format'
import { IncidentRow } from './IncidentRow'

interface IncidentListProps {
  data: IncidentListData | undefined
  error: ApiError | null
  isPending: boolean
  /** Dados do filtro anterior, exibidos enquanto os do novo filtro chegam. */
  isPlaceholderData: boolean
  dataUpdatedAt: number
  hasActiveFilters: boolean
  onRetry: () => void
  onClearFilters: () => void
  onPageChange: (offset: number) => void
}

export function IncidentList({
  data,
  error,
  isPending,
  isPlaceholderData,
  dataUpdatedAt,
  hasActiveFilters,
  onRetry,
  onClearFilters,
  onPageChange,
}: IncidentListProps) {
  // Faz o "há X min" de cada incidente andar sozinho.
  const now = useNow(30_000)

  if (isPending) return <IncidentListSkeleton />

  if (!data) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <AlertTriangle className="size-8 text-destructive" aria-hidden />
        <div>
          <p className="font-medium">Não foi possível carregar os incidentes.</p>
          <p className="text-sm text-muted-foreground">{error?.message}</p>
        </div>
        <Button onClick={onRetry}>
          <RotateCw aria-hidden /> Tentar novamente
        </Button>
      </div>
    )
  }

  if (data.items.length === 0) {
    return hasActiveFilters ? (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <SearchX className="size-8 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">Nenhum incidente com esses filtros.</p>
          <p className="text-sm text-muted-foreground">Ajuste os filtros ou limpe para ver a fila completa.</p>
        </div>
        <Button variant="outline" onClick={onClearFilters}>
          Limpar filtros
        </Button>
      </div>
    ) : (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <CheckCircle2 className="size-8 text-status-closed" aria-hidden />
        <div>
          <p className="font-medium">Nenhum incidente aguardando ação.</p>
          <p className="text-sm text-muted-foreground">Novos incidentes aparecem aqui automaticamente.</p>
        </div>
      </div>
    )
  }

  const firstItem = data.offset + 1
  const lastItem = data.offset + data.items.length

  return (
    <div className="space-y-3">
      {/* Falhou ao atualizar, mas há dados anteriores: eles continuam na tela, com aviso. */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Não foi possível atualizar: {error.message} Exibindo os dados de{' '}
              {formatTime(dataUpdatedAt)}.
            </span>
            <Button size="sm" variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground" aria-live="polite">
        <span className="font-medium text-foreground tabular-nums">{data.total}</span>{' '}
        {data.total === 1 ? 'incidente' : 'incidentes'}
      </p>

      <ul
        aria-label="Incidentes, do mais prioritário para o menos"
        aria-busy={isPlaceholderData}
        className={cn('space-y-2 transition-opacity', isPlaceholderData && 'opacity-60')}
      >
        {data.items.map((incident) => (
          <IncidentRow key={incident.id} incident={incident} now={now} />
        ))}
      </ul>

      {data.total > PAGE_SIZE && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground tabular-nums">
            {firstItem}–{lastItem} de {data.total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.offset === 0}
              onClick={() => onPageChange(Math.max(0, data.offset - PAGE_SIZE))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={lastItem >= data.total}
              onClick={() => onPageChange(data.offset + PAGE_SIZE)}
            >
              Próxima
            </Button>
          </div>
        </nav>
      )}
    </div>
  )
}

function IncidentListSkeleton() {
  return (
    <div role="status" aria-label="Carregando incidentes" className="space-y-2">
      {Array.from({ length: 8 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 rounded-lg border p-3">
          <Skeleton className="h-4 w-20" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  )
}
