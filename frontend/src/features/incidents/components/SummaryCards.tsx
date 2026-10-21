import type { IncidentStatus, IncidentSummary } from '@/api/types'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { sameItems } from '../use-incident-filters'
import type { IncidentFilters } from '../use-incident-filters'

interface CardDefinition {
  label: string
  hint: string
  value: (summary: IncidentSummary) => number
  /** Filtros aplicados ao clicar no card. */
  filters: Pick<IncidentFilters, 'status' | 'criticality'>
  /** Card que acende em vermelho quando há algo nele: é a exceção que exige ação. */
  alarm?: boolean
}

const CARDS: CardDefinition[] = [
  {
    label: 'Alta, sem responsável',
    hint: 'Criticidade alta aguardando alguém assumir',
    value: (summary) => summary.open_by_criticality.HIGH,
    filters: { status: ['OPEN'], criticality: ['HIGH'] },
    alarm: true,
  },
  {
    label: 'Aguardando responsável',
    hint: 'Todos os incidentes abertos',
    value: (summary) => summary.by_status.OPEN,
    filters: { status: ['OPEN'], criticality: [] },
  },
  {
    label: 'Em investigação',
    hint: 'Já assumidos por um analista',
    value: (summary) => summary.by_status.INVESTIGATING,
    filters: { status: ['INVESTIGATING'], criticality: [] },
  },
  {
    label: 'Encerrados',
    hint: 'Fechados ou inconclusivos',
    value: (summary) => summary.by_status.CLOSED + summary.by_status.INCONCLUSIVE,
    filters: { status: ['CLOSED', 'INCONCLUSIVE'] as IncidentStatus[], criticality: [] },
  },
]

interface SummaryCardsProps {
  summary: IncidentSummary | undefined
  filters: IncidentFilters
  onSelect: (filters: Pick<IncidentFilters, 'status' | 'criticality'>) => void
}

export function SummaryCards({ summary, filters, onSelect }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = summary ? card.value(summary) : undefined
        const active =
          sameItems(filters.status, card.filters.status) &&
          sameItems(filters.criticality, card.filters.criticality) &&
          filters.category.length === 0
        const alarming = card.alarm && value !== undefined && value > 0

        return (
          <button
            key={card.label}
            type="button"
            aria-pressed={active}
            title={card.hint}
            onClick={() => onSelect(card.filters)}
            className={cn(
              'rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50',
              'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              active && 'bg-muted/60 ring-2 ring-foreground/30',
              alarming && 'border-critical-high/40 bg-critical-high/5 hover:bg-critical-high/10',
            )}
          >
            <span className="block text-xs text-muted-foreground">{card.label}</span>
            {value === undefined ? (
              <Skeleton className="mt-1 h-7 w-12" />
            ) : (
              <span
                className={cn(
                  'block text-2xl font-semibold tabular-nums',
                  alarming && 'text-critical-high',
                )}
              >
                {value}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
