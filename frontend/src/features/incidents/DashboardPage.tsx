import { useCallback } from 'react'

import { FilterBar } from './components/FilterBar'
import { FreshnessIndicator } from './components/FreshnessIndicator'
import { IncidentList } from './components/IncidentList'
import { SummaryCards } from './components/SummaryCards'
import { useIncidentList, useIncidentSummary } from './queries'
import { useIncidentFilters } from './use-incident-filters'
import type { IncidentFilters } from './use-incident-filters'

export function DashboardPage() {
  const { filters, setFilters, toggle, clear, isDefault } = useIncidentFilters()
  const list = useIncidentList(filters)
  const summary = useIncidentSummary()

  const refresh = () => {
    void list.refetch()
    void summary.refetch()
  }

  const selectSummaryCard = (cardFilters: Pick<IncidentFilters, 'status' | 'criticality'>) =>
    setFilters({ ...cardFilters, category: [], q: '' })

  // Digitar na busca não empilha uma entrada no histórico do navegador a cada pausa.
  const search = useCallback((q: string) => setFilters({ q }, { replace: true }), [setFilters])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Painel de incidentes</h1>
          <p className="text-sm text-muted-foreground">
            Ordenados por prioridade: criticidade, gravidade e tempo de espera.
          </p>
        </div>
        <FreshnessIndicator
          updatedAt={list.dataUpdatedAt}
          isFetching={list.isFetching}
          onRefresh={refresh}
        />
      </div>

      <SummaryCards summary={summary.data} filters={filters} onSelect={selectSummaryCard} />

      <FilterBar
        filters={filters}
        isDefault={isDefault}
        onToggle={toggle}
        onSearch={search}
        onClear={clear}
      />

      <IncidentList
        data={list.data}
        error={list.error}
        isPending={list.isPending}
        isPlaceholderData={list.isPlaceholderData}
        dataUpdatedAt={list.dataUpdatedAt}
        hasActiveFilters={!isDefault}
        onRetry={() => void list.refetch()}
        onClearFilters={clear}
        onPageChange={(offset) => setFilters({ ...filters, offset })}
      />
    </div>
  )
}
