import { Plus } from 'lucide-react'
import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'

import { FilterBar } from './components/FilterBar'
import { FreshnessIndicator } from './components/FreshnessIndicator'
import { IncidentDrawer } from './components/IncidentDrawer'
import { IncidentList } from './components/IncidentList'
import { SummaryCards } from './components/SummaryCards'
import { IncidentFormSheet } from './form/IncidentFormSheet'
import { useIncidentList, useIncidentSummary } from './queries'
import { useIncidentFilters } from './use-incident-filters'
import { useSelectedIncident } from './use-selected-incident'
import type { IncidentFilters } from './use-incident-filters'

export function DashboardPage() {
  const { filters, setFilters, toggle, clear, isDefault } = useIncidentFilters()
  const list = useIncidentList(filters)
  const summary = useIncidentSummary()
  const selected = useSelectedIncident()
  const [creating, setCreating] = useState(false)

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
        <div className="flex items-center gap-2">
          <FreshnessIndicator
            updatedAt={list.dataUpdatedAt}
            isFetching={list.isFetching}
            onRefresh={refresh}
          />
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden /> Novo incidente
          </Button>
        </div>
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
        onSelect={selected.open}
      />

      <IncidentDrawer incidentId={selected.selectedId} onClose={selected.close} />

      <IncidentFormSheet
        open={creating}
        onOpenChange={setCreating}
        form={{
          mode: 'create',
          // Depois de registrar, abre o incidente novo para o analista já poder assumi-lo.
          onDone: (created) => {
            setCreating(false)
            selected.open(created.id)
          },
        }}
      />
    </div>
  )
}
