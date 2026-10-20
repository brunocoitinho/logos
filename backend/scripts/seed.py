"""Carga de dados de demonstração: 3 analistas e ~100 incidentes.

Uso (na pasta backend/):
    python -m scripts.seed                 # 100 incidentes
    python -m scripts.seed --incidents 50

Os analistas são mantidos entre execuções (sem duplicar); os incidentes são recriados.
"""

import argparse
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.base import utc_now
from app.db.session import SessionLocal
from app.models import Incident, IncidentEvent, User
from app.models.enums import IncidentEventType, IncidentStatus
from scripts.fake_data import generate_incident_data, minutes_ago

# Senha única dos analistas de demonstração, exibida na tela de login e no README.
DEMO_PASSWORD = "logos2026"

DEMO_ANALYSTS = [
    ("Ana Souza", "ana@logos.demo"),
    ("Bruno Costa", "bruno@logos.demo"),
    ("Carla Mendes", "carla@logos.demo"),
]

# Conta usada pela integração dos caminhões (simulador). Não é um analista: no histórico,
# os incidentes aparecem como enviados pela telemetria, e não por uma pessoa.
FLEET_ACCOUNT = ("Telemetria da Frota", "frota@logos.demo")

# A maioria aberta: é o cenário de pressão que a tela precisa resolver.
STATUS_WEIGHTS: dict[IncidentStatus, int] = {
    IncidentStatus.OPEN: 60,
    IncidentStatus.INVESTIGATING: 20,
    IncidentStatus.CLOSED: 12,
    IncidentStatus.INCONCLUSIVE: 8,
}

RESOLUTION_NOTES: dict[IncidentStatus, list[str]] = {
    IncidentStatus.CLOSED: [
        "Guincho acionado e veículo removido. Motorista seguiu viagem.",
        "Socorro mecânico resolveu no local. Viagem retomada.",
        "PRF liberou a pista. Motorista seguiu com escolta.",
        "Vítimas atendidas pelo SAMU. Carga transferida para outro veículo.",
    ],
    IncidentStatus.INCONCLUSIVE: [
        "Motorista não respondeu às tentativas de contato. Rastreador indica veículo em movimento.",
        "Ocorrência não confirmada pela PRF no local informado.",
        "Informações conflitantes entre motorista e base. Encaminhado para auditoria.",
    ],
}


@dataclass
class SeedResult:
    analysts: int
    incidents: int


def ensure_seed_allowed(environment: str, allow_production: bool) -> None:
    """Impede apagar incidentes de produção por engano."""
    if environment == "production" and not allow_production:
        sys.exit("Seed bloqueado em produção. Use --allow-production se for intencional.")


def upsert_user(db: Session, name: str, email: str) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(name=name, email=email, password_hash=hash_password(DEMO_PASSWORD))
        db.add(user)
    return user


def build_incident(
    rng: random.Random,
    now: datetime,
    status: IncidentStatus,
    analysts: list[User],
    fleet: User,
) -> tuple[Incident, list[IncidentEvent]]:
    if status == IncidentStatus.OPEN:
        reported_at = minutes_ago(now, rng, 1, 360)
    elif status == IncidentStatus.INVESTIGATING:
        reported_at = minutes_ago(now, rng, 30, 480)
    else:
        reported_at = minutes_ago(now, rng, 120, 48 * 60)

    incident = Incident(**generate_incident_data(rng, reported_at), status=status)
    # Incidente chega pela telemetria do caminhão.
    events = [
        IncidentEvent(
            type=IncidentEventType.CREATED,
            user=fleet,
            to_status=IncidentStatus.OPEN,
            created_at=reported_at,
        )
    ]

    if status == IncidentStatus.OPEN:
        return incident, events

    analyst = rng.choice(analysts)
    claimed_at = reported_at + timedelta(minutes=rng.randint(2, 25))
    incident.assigned_to = analyst
    incident.assigned_at = claimed_at
    events.append(
        IncidentEvent(
            type=IncidentEventType.CLAIMED,
            user=analyst,
            from_status=IncidentStatus.OPEN,
            to_status=IncidentStatus.INVESTIGATING,
            created_at=claimed_at,
        )
    )

    if status == IncidentStatus.INVESTIGATING:
        return incident, events

    note = rng.choice(RESOLUTION_NOTES[status])
    incident.resolution_note = note
    events.append(
        IncidentEvent(
            type=IncidentEventType.STATUS_CHANGED,
            user=analyst,
            from_status=IncidentStatus.INVESTIGATING,
            to_status=status,
            note=note,
            created_at=claimed_at + timedelta(minutes=rng.randint(10, 90)),
        )
    )
    return incident, events


def seed(
    db: Session,
    incident_count: int = 100,
    rng: random.Random | None = None,
    now: datetime | None = None,
) -> SeedResult:
    rng = rng or random.Random()
    now = now or utc_now()

    analysts = [upsert_user(db, name, email) for name, email in DEMO_ANALYSTS]
    fleet = upsert_user(db, *FLEET_ACCOUNT)
    db.flush()

    db.execute(delete(IncidentEvent))
    db.execute(delete(Incident))

    statuses = list(STATUS_WEIGHTS)
    weights = list(STATUS_WEIGHTS.values())
    for _ in range(incident_count):
        status = rng.choices(statuses, weights=weights)[0]
        incident, events = build_incident(rng, now, status, analysts, fleet)
        incident.events = events
        db.add(incident)

    db.commit()
    return SeedResult(analysts=len(analysts), incidents=incident_count)


def main() -> None:
    parser = argparse.ArgumentParser(description="Carga de dados de demonstração do Logos.")
    parser.add_argument("--incidents", type=int, default=100, help="quantidade de incidentes")
    parser.add_argument("--allow-production", action="store_true", help="permite rodar em produção")
    args = parser.parse_args()

    settings = get_settings()
    ensure_seed_allowed(settings.environment, args.allow_production)

    with SessionLocal() as db:
        result = seed(db, incident_count=args.incidents)

    print(f"Seed concluído: {result.analysts} analistas e {result.incidents} incidentes.")
    print(f"Login de demonstração: {DEMO_ANALYSTS[0][1]} / senha {DEMO_PASSWORD}")


if __name__ == "__main__":
    main()
