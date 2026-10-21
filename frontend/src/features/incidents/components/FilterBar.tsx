import { ListFilter, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import {
  CATEGORY,
  CATEGORY_ORDER,
  CRITICALITY,
  CRITICALITY_ORDER,
  DEFAULT_STATUSES,
  STATUS,
  STATUS_ORDER,
} from '../constants'
import { sameItems } from '../use-incident-filters'
import type { IncidentFilters } from '../use-incident-filters'

const SEARCH_DEBOUNCE_MS = 300

interface FilterBarProps {
  filters: IncidentFilters
  isDefault: boolean
  onToggle: <K extends 'status' | 'criticality' | 'category'>(key: K, value: IncidentFilters[K][number]) => void
  onSearch: (q: string) => void
  onClear: () => void
}

export function FilterBar({ filters, isDefault, onToggle, onSearch, onClear }: FilterBarProps) {
  // No celular, os chips ficam recolhidos: a fila de incidentes aparece primeiro.
  const [showChips, setShowChips] = useState(false)
  const activeChipCount =
    filters.criticality.length + filters.category.length + (isDefaultStatus(filters) ? 0 : 1)

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={filters.q} onSearch={onSearch} />
        <Button
          variant="outline"
          size="sm"
          className="sm:hidden"
          aria-expanded={showChips}
          aria-controls="incident-filter-chips"
          onClick={() => setShowChips((open) => !open)}
        >
          <ListFilter aria-hidden />
          Filtros{activeChipCount > 0 && ` (${activeChipCount})`}
        </Button>
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X aria-hidden /> Limpar filtros
          </Button>
        )}
      </div>

      <div
        id="incident-filter-chips"
        className={cn('flex-wrap gap-x-6 gap-y-3 sm:flex', showChips ? 'flex' : 'hidden')}
      >
        <ChipGroup label="Criticidade">
          {CRITICALITY_ORDER.map((value) => (
            <Chip
              key={value}
              pressed={filters.criticality.includes(value)}
              onClick={() => onToggle('criticality', value)}
            >
              <span aria-hidden className={cn('size-2 rounded-full', CRITICALITY[value].dot)} />
              {CRITICALITY[value].label}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Status">
          {STATUS_ORDER.map((value) => (
            <Chip key={value} pressed={filters.status.includes(value)} onClick={() => onToggle('status', value)}>
              {STATUS[value].label}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Categoria">
          {CATEGORY_ORDER.map((value) => {
            const Icon = CATEGORY[value].icon
            return (
              <Chip
                key={value}
                pressed={filters.category.includes(value)}
                onClick={() => onToggle('category', value)}
                title={CATEGORY[value].label}
              >
                <Icon className="size-3.5" aria-hidden />
                {CATEGORY[value].short}
              </Chip>
            )
          })}
        </ChipGroup>
      </div>
    </div>
  )
}

function isDefaultStatus(filters: IncidentFilters): boolean {
  return sameItems(filters.status, DEFAULT_STATUSES)
}

function SearchInput({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value)
  const [lastUrlValue, setLastUrlValue] = useState(value)

  // A busca mudou por fora (ex.: "Limpar filtros"): o campo acompanha a URL.
  // Ajuste durante a renderização, padrão recomendado pelo React em vez de um useEffect.
  if (value !== lastUrlValue) {
    setLastUrlValue(value)
    setText(value)
  }

  // Só busca quando a digitação para por um instante, e não a cada tecla.
  useEffect(() => {
    if (text.trim() === value) return
    const timer = window.setTimeout(() => onSearch(text), SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [text, value, onSearch])

  return (
    <div className="relative w-full sm:w-80">
      <Search
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        aria-label="Buscar incidentes"
        placeholder="Buscar por título, placa, rodovia ou cidade"
        maxLength={100}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="pl-8"
      />
    </div>
  )
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

interface ChipProps {
  pressed: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}

function Chip({ pressed, onClick, title, children }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
        'focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        pressed
          ? 'border-foreground bg-foreground text-background'
          : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
