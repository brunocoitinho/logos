import { describe, expect, it } from 'vitest'

import { makeIncident, minutesAgo } from '@/test/factories'

import { formatElapsed, formatLocation, isOverSla, minutesSince } from './format'

describe('formatação', () => {
  it.each([
    [0, 'agora'],
    [5, 'há 5 min'],
    [60, 'há 1 h'],
    [130, 'há 2 h 10 min'],
    [60 * 24, 'há 1 dia'],
    [60 * 24 * 3, 'há 3 dias'],
  ])('%i minutos → "%s"', (minutes, expected) => {
    expect(formatElapsed(minutes)).toBe(expected)
  })

  it('nunca mostra tempo negativo (relógio do navegador adiantado)', () => {
    const future = new Date(Date.now() + 5 * 60_000).toISOString()
    expect(minutesSince(future, Date.now())).toBe(0)
  })

  it('formata a localização no padrão brasileiro', () => {
    expect(formatLocation(makeIncident({ highway: 'BR-116', km: 152.4 }))).toBe('BR-116 km 152,4')
  })
})

describe('SLA por criticidade (premissa do MVP: Alta 15 min, Média 60 min, Baixa 4 h)', () => {
  it.each([
    ['HIGH', 16, true],
    ['HIGH', 14, false],
    ['MEDIUM', 61, true],
    ['MEDIUM', 59, false],
    ['LOW', 241, true],
    ['LOW', 239, false],
  ] as const)('%s aberto há %i min → acima do SLA: %s', (criticality, minutes, expected) => {
    const incident = makeIncident({ criticality, reported_at: minutesAgo(minutes) })
    // "now" depois de criar o incidente: calculado antes, "há 16 min" viraria 15,99 min.
    expect(isOverSla(incident, Date.now())).toBe(expected)
  })

  it('incidente já assumido não conta como atrasado', () => {
    const incident = makeIncident({
      criticality: 'HIGH',
      status: 'INVESTIGATING',
      reported_at: minutesAgo(120),
    })
    expect(isOverSla(incident, Date.now())).toBe(false)
  })
})
