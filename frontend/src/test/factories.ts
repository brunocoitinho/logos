import type { Incident, IncidentList } from '@/api/types'

let nextId = 1

/** Incidente válido com valores padrão; cada teste sobrescreve só o que importa para ele. */
export function makeIncident(overrides: Partial<Incident> = {}): Incident {
  const id = nextId++
  const now = new Date().toISOString()
  return {
    id,
    title: `Incidente ${id}`,
    description: null,
    category: 'MECHANICAL_FAILURE',
    criticality: 'LOW',
    status: 'OPEN',
    vehicle_plate: 'ABC1D23',
    highway: 'BR-116',
    km: 152.4,
    city: 'Resende',
    state: 'RJ',
    reported_at: now,
    assigned_to: null,
    assigned_at: null,
    resolution_note: null,
    version: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

export function makeList(items: Incident[], overrides: Partial<IncidentList> = {}): IncidentList {
  return { items, total: items.length, limit: 100, offset: 0, ...overrides }
}

export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}
