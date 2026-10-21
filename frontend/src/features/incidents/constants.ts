import {
  Ambulance,
  CarFront,
  CircleAlert,
  CloudLightning,
  Construction,
  OctagonAlert,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { Criticality, IncidentCategory, IncidentStatus } from '@/api/types'

// As classes são escritas por extenso (e não montadas com template string) porque o
// Tailwind só gera o CSS das classes que encontra literalmente no código.

interface CriticalityStyle {
  label: string
  /** Formas diferentes (octógono, triângulo, círculo): distinguíveis mesmo sem enxergar cor. */
  icon: LucideIcon
  bar: string
  text: string
  badge: string
  dot: string
  /** Tempo máximo esperando um responsável (premissa do MVP). */
  slaMinutes: number
}

export const CRITICALITY: Record<Criticality, CriticalityStyle> = {
  HIGH: {
    label: 'Alta',
    icon: OctagonAlert,
    bar: 'bg-critical-high',
    text: 'text-critical-high',
    badge: 'border-critical-high/30 bg-critical-high/10 text-critical-high',
    dot: 'bg-critical-high',
    slaMinutes: 15,
  },
  MEDIUM: {
    label: 'Média',
    icon: TriangleAlert,
    bar: 'bg-critical-medium',
    text: 'text-critical-medium',
    badge: 'border-critical-medium/30 bg-critical-medium/10 text-critical-medium',
    dot: 'bg-critical-medium',
    slaMinutes: 60,
  },
  LOW: {
    label: 'Baixa',
    icon: CircleAlert,
    bar: 'bg-critical-low',
    text: 'text-critical-low',
    badge: 'border-critical-low/30 bg-critical-low/10 text-critical-low',
    dot: 'bg-critical-low',
    slaMinutes: 240,
  },
}

export const CATEGORY: Record<IncidentCategory, { label: string; short: string; icon: LucideIcon }> =
  {
    ACCIDENT_WITH_VICTIMS: { label: 'Acidente com Vítimas', short: 'Com vítimas', icon: Ambulance },
    VEHICLE_ACCIDENT: { label: 'Acidente com Veículo', short: 'Acidente', icon: CarFront },
    ROAD_BLOCKED: { label: 'Bloqueio de Pista', short: 'Bloqueio', icon: Construction },
    ADVERSE_WEATHER: {
      label: 'Condição Climática Atípica',
      short: 'Clima',
      icon: CloudLightning,
    },
    MECHANICAL_FAILURE: { label: 'Problema Mecânico', short: 'Mecânico', icon: Wrench },
  }

export const STATUS: Record<IncidentStatus, { label: string; badge: string }> = {
  OPEN: { label: 'Aberto', badge: 'border-border bg-background text-foreground' },
  INVESTIGATING: {
    label: 'Em investigação',
    badge: 'border-status-investigating/30 bg-status-investigating/10 text-status-investigating',
  },
  CLOSED: {
    label: 'Fechado',
    badge: 'border-status-closed/30 bg-status-closed/10 text-status-closed',
  },
  INCONCLUSIVE: { label: 'Inconclusivo', badge: 'border-border bg-muted text-muted-foreground' },
}

// Mesma ordem de prioridade da API (backend/app/services/incidents.py).
export const CRITICALITY_ORDER: Criticality[] = ['HIGH', 'MEDIUM', 'LOW']
export const CATEGORY_ORDER: IncidentCategory[] = [
  'ACCIDENT_WITH_VICTIMS',
  'VEHICLE_ACCIDENT',
  'ROAD_BLOCKED',
  'ADVERSE_WEATHER',
  'MECHANICAL_FAILURE',
]
export const STATUS_ORDER: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'CLOSED', 'INCONCLUSIVE']

/** Gestão por exceção: sem filtro de status, mostra só o que ainda exige ação. */
export const DEFAULT_STATUSES: IncidentStatus[] = ['OPEN', 'INVESTIGATING']

export const PAGE_SIZE = 100

/** A lista e os contadores se atualizam sozinhos neste intervalo. */
export const REFRESH_INTERVAL_MS = 10_000
