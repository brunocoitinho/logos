import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import type { Criticality, IncidentCategory, IncidentStatus } from '@/api/types'

import { CATEGORY_ORDER, CRITICALITY_ORDER, DEFAULT_STATUSES, STATUS_ORDER } from './constants'

export interface IncidentFilters {
  status: IncidentStatus[]
  criticality: Criticality[]
  category: IncidentCategory[]
  q: string
  offset: number
}

type ListFilterKey = 'status' | 'criticality' | 'category'

const ALLOWED: Record<ListFilterKey, readonly string[]> = {
  status: STATUS_ORDER,
  criticality: CRITICALITY_ORDER,
  category: CATEGORY_ORDER,
}

/** Lê da URL só valores conhecidos, na ordem canônica (links editados à mão não quebram a tela). */
function readList<T extends string>(params: URLSearchParams, key: ListFilterKey): T[] {
  const values = new Set(params.getAll(key))
  return ALLOWED[key].filter((value) => values.has(value)) as T[]
}

function sameItems(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value))
}

/**
 * Filtros guardados na URL (fonte da verdade): F5 mantém o filtro, o "voltar" do navegador
 * desfaz a última mudança e um link compartilhado abre a mesma visão.
 */
export function useIncidentFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo<IncidentFilters>(() => {
    const status = readList<IncidentStatus>(searchParams, 'status')
    const offset = Number(searchParams.get('offset'))
    return {
      status: status.length ? status : DEFAULT_STATUSES,
      criticality: readList<Criticality>(searchParams, 'criticality'),
      category: readList<IncidentCategory>(searchParams, 'category'),
      q: searchParams.get('q') ?? '',
      offset: Number.isInteger(offset) && offset > 0 ? offset : 0,
    }
  }, [searchParams])

  const setFilters = useCallback(
    (changes: Partial<IncidentFilters>, options: { replace?: boolean } = {}) => {
      const next = { ...filters, offset: 0, ...changes }
      const params = new URLSearchParams()
      // O status padrão não vai para a URL: mantém o link limpo.
      if (!sameItems(next.status, DEFAULT_STATUSES)) {
        next.status.forEach((value) => params.append('status', value))
      }
      next.criticality.forEach((value) => params.append('criticality', value))
      next.category.forEach((value) => params.append('category', value))
      if (next.q.trim()) params.set('q', next.q.trim())
      if (next.offset > 0) params.set('offset', String(next.offset))
      setSearchParams(params, { replace: options.replace })
    },
    [filters, setSearchParams],
  )

  const toggle = useCallback(
    <K extends ListFilterKey>(key: K, value: IncidentFilters[K][number]) => {
      const current = filters[key] as string[]
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
      setFilters({ [key]: next })
    },
    [filters, setFilters],
  )

  const clear = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams])

  const isDefault =
    sameItems(filters.status, DEFAULT_STATUSES) &&
    filters.criticality.length === 0 &&
    filters.category.length === 0 &&
    filters.q === ''

  return { filters, setFilters, toggle, clear, isDefault }
}

export { sameItems }
