// Tipos espelhando os schemas da API (backend/app/schemas).

export type IncidentCategory =
  | 'VEHICLE_ACCIDENT'
  | 'ACCIDENT_WITH_VICTIMS'
  | 'ADVERSE_WEATHER'
  | 'MECHANICAL_FAILURE'
  | 'ROAD_BLOCKED'

export type Criticality = 'HIGH' | 'MEDIUM' | 'LOW'

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'CLOSED' | 'INCONCLUSIVE'

export type IncidentEventType =
  | 'CREATED'
  | 'UPDATED'
  | 'CLAIMED'
  | 'RELEASED'
  | 'STATUS_CHANGED'
  | 'REOPENED'
  | 'DELETED'

export interface UserSummary {
  id: number
  name: string
}

export interface User extends UserSummary {
  email: string
}

export interface TokenResponse {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  user: User
}

export interface Incident {
  id: number
  title: string
  description: string | null
  category: IncidentCategory
  criticality: Criticality
  status: IncidentStatus
  vehicle_plate: string
  highway: string
  km: number
  city: string
  state: string
  reported_at: string
  assigned_to: UserSummary | null
  assigned_at: string | null
  resolution_note: string | null
  version: number
  created_at: string
  updated_at: string
}

export interface IncidentList {
  items: Incident[]
  total: number
  limit: number
  offset: number
}

export interface CriticalityCount {
  HIGH: number
  MEDIUM: number
  LOW: number
}

export interface IncidentSummary {
  by_status: Record<IncidentStatus, number>
  open_by_criticality: CriticalityCount
  investigating_by_criticality: CriticalityCount
}

export interface IncidentEvent {
  id: number
  type: IncidentEventType
  from_status: IncidentStatus | null
  to_status: IncidentStatus | null
  note: string | null
  user: UserSummary | null
  created_at: string
}

// Formato único de erro da API: {"error": {"code", "message", "details"}}
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}
