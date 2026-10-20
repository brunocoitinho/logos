from enum import StrEnum


class IncidentCategory(StrEnum):
    VEHICLE_ACCIDENT = "VEHICLE_ACCIDENT"  # Acidente com Veículo
    ACCIDENT_WITH_VICTIMS = "ACCIDENT_WITH_VICTIMS"  # Acidente com Vítimas
    ADVERSE_WEATHER = "ADVERSE_WEATHER"  # Condição Climática Atípica na Pista
    MECHANICAL_FAILURE = "MECHANICAL_FAILURE"  # Problema Mecânico
    ROAD_BLOCKED = "ROAD_BLOCKED"  # Bloqueio de Pista


class Criticality(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class IncidentStatus(StrEnum):
    OPEN = "OPEN"  # Aberto
    INVESTIGATING = "INVESTIGATING"  # Em Investigação
    CLOSED = "CLOSED"  # Fechado
    INCONCLUSIVE = "INCONCLUSIVE"  # Inconclusivo


class IncidentEventType(StrEnum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"
    CLAIMED = "CLAIMED"
    RELEASED = "RELEASED"
    STATUS_CHANGED = "STATUS_CHANGED"
    REOPENED = "REOPENED"
    DELETED = "DELETED"
