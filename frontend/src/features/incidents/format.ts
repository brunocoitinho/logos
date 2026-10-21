import type { Incident } from '@/api/types'

import { CRITICALITY } from './constants'

const MINUTE_MS = 60_000

export function minutesSince(isoDate: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / MINUTE_MS))
}

/** "agora", "há 5 min", "há 2 h 10 min", "há 3 dias". */
export function formatElapsed(minutes: number): string {
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const rest = minutes % 60
    return rest ? `há ${hours} h ${rest} min` : `há ${hours} h`
  }
  const days = Math.floor(hours / 24)
  return days === 1 ? 'há 1 dia' : `há ${days} dias`
}

/**
 * Incidente aberto (ninguém assumiu) há mais tempo que o SLA da sua criticidade.
 * Os prazos são premissa do MVP: Alta 15 min, Média 60 min, Baixa 4 h.
 */
export function isOverSla(incident: Incident, now: number): boolean {
  if (incident.status !== 'OPEN') return false
  return minutesSince(incident.reported_at, now) > CRITICALITY[incident.criticality].slaMinutes
}

const kmFormat = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const timeFormat = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' })

/** "BR-116 km 152,4" */
export function formatLocation(incident: Incident): string {
  return `${incident.highway} km ${kmFormat.format(incident.km)}`
}

/** Data e hora no fuso do navegador (a API devolve UTC). */
export function formatDateTime(isoDate: string): string {
  return dateTimeFormat.format(new Date(isoDate))
}

export function formatTime(timestamp: number): string {
  return timeFormat.format(new Date(timestamp))
}
