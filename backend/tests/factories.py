"""Funções para criar dados de teste com valores padrão válidos.

Cada teste sobrescreve só o que importa para ele, o que deixa claro o que está sendo testado.
"""

from decimal import Decimal
from itertools import count

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Incident, User
from app.models.enums import Criticality, IncidentCategory, IncidentStatus

TEST_PASSWORD = "senha-de-teste"

_sequence = count(1)


def create_user(db: Session, password: str = TEST_PASSWORD, **overrides) -> User:
    number = next(_sequence)
    data = {
        "name": f"Analista {number}",
        "email": f"analista{number}@logos.test",
        "password_hash": hash_password(password),
    }
    user = User(**(data | overrides))
    db.add(user)
    db.commit()
    return user


def create_incident(db: Session, **overrides) -> Incident:
    data = {
        "title": "Pneu furado no acostamento",
        "description": "Motorista relata pneu dianteiro furado.",
        "category": IncidentCategory.MECHANICAL_FAILURE,
        "criticality": Criticality.LOW,
        "status": IncidentStatus.OPEN,
        "vehicle_plate": "ABC1D23",
        "highway": "BR-116",
        "km": Decimal("152.4"),
        "city": "Resende",
        "state": "RJ",
    }
    incident = Incident(**(data | overrides))
    db.add(incident)
    db.commit()
    return incident
