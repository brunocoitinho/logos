from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Annotated

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
    field_validator,
    model_validator,
)

from app.models.enums import Criticality, IncidentCategory, IncidentEventType, IncidentStatus

BRAZILIAN_STATES = {
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
    "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
}  # fmt: skip

# Maior valor de uma coluna INT do MySQL: ids e versões acima disso não podem existir.
MAX_INT = 2_147_483_647
MAX_OFFSET = 1_000_000

# Tolerância para relógios de dispositivos levemente adiantados.
FUTURE_TOLERANCE = timedelta(minutes=5)


def _normalize_plate(value: object) -> object:
    """Aceita "abc-1d23" ou "ABC 1D23" e guarda "ABC1D23"."""
    if isinstance(value, str):
        return value.replace("-", "").replace(" ", "").upper()
    return value


def _normalize_upper(value: object) -> object:
    return value.strip().upper() if isinstance(value, str) else value


def _to_utc_naive(value: datetime) -> datetime:
    """Datas chegam com qualquer fuso; o banco guarda UTC sem fuso."""
    if value.tzinfo is not None:
        value = value.astimezone(UTC).replace(tzinfo=None)
    return value


def _check_state(value: str) -> str:
    if value not in BRAZILIAN_STATES:
        raise ValueError("UF inválida")
    return value


# Placa antiga (ABC1234) ou Mercosul (ABC1D23).
VehiclePlate = Annotated[
    str, BeforeValidator(_normalize_plate), Field(pattern=r"^[A-Z]{3}\d[A-Z0-9]\d{2}$")
]
Highway = Annotated[
    str, BeforeValidator(_normalize_upper), Field(pattern=r"^[A-Z]{2}-\d{3}$", examples=["BR-116"])
]
State = Annotated[str, BeforeValidator(_normalize_upper), AfterValidator(_check_state)]
Kilometer = Annotated[
    Decimal,
    Field(ge=0, le=9999.9, max_digits=5, decimal_places=1),
    # Decimal vira número no JSON (o padrão do Pydantic seria string).
    PlainSerializer(float, return_type=float),
]
Title = Annotated[str, Field(min_length=3, max_length=120)]
Version = Annotated[
    int, Field(ge=1, le=MAX_INT, description="Versão que o cliente leu (optimistic locking).")
]
Description = Annotated[str, Field(max_length=2000)]
City = Annotated[str, Field(min_length=2, max_length=100)]
InputDatetime = Annotated[datetime, AfterValidator(_to_utc_naive)]
# O banco guarda UTC sem fuso; na saída o fuso é explicitado para o front converter.
UtcDatetime = Annotated[
    datetime,
    AfterValidator(lambda value: value.replace(tzinfo=UTC) if value.tzinfo is None else value),
]


class StrictInput(BaseModel):
    # Campos desconhecidos são recusados (ex.: tentar mudar "status" pelo PATCH).
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class IncidentCreate(StrictInput):
    title: Title
    description: Description | None = None
    category: IncidentCategory
    criticality: Criticality
    vehicle_plate: VehiclePlate
    highway: Highway
    km: Kilometer
    city: City
    state: State
    reported_at: InputDatetime | None = Field(
        default=None, description="Momento do incidente. Se omitido, usa o momento do envio."
    )

    @field_validator("reported_at")
    @classmethod
    def reported_at_not_in_future(cls, value: datetime | None) -> datetime | None:
        if value is not None and value > datetime.now(UTC).replace(tzinfo=None) + FUTURE_TOLERANCE:
            raise ValueError("a data do incidente não pode estar no futuro")
        return value


class IncidentUpdate(StrictInput):
    """Edição de dados descritivos. Status muda apenas pelas ações de ciclo de vida."""

    version: Version
    title: Title | None = None
    description: Description | None = None
    category: IncidentCategory | None = None
    criticality: Criticality | None = None
    vehicle_plate: VehiclePlate | None = None
    highway: Highway | None = None
    km: Kilometer | None = None
    city: City | None = None
    state: State | None = None

    @model_validator(mode="after")
    def validate_changes(self) -> "IncidentUpdate":
        changes = self.changes()
        if not changes:
            raise ValueError("informe ao menos um campo para alterar")
        # Só a descrição é opcional no banco; "title": null apagaria um campo obrigatório.
        nulled = sorted(
            name for name, value in changes.items() if value is None and name != "description"
        )
        if nulled:
            raise ValueError(f"campos obrigatórios não podem ser nulos: {', '.join(nulled)}")
        return self

    def changes(self) -> dict:
        return self.model_dump(exclude_unset=True, exclude={"version"})


class IncidentFilters(BaseModel):
    """Parâmetros de busca da lista. Parâmetro desconhecido na URL gera 422."""

    model_config = ConfigDict(extra="forbid")

    # Padrão = gestão por exceção: só o que ainda exige ação.
    status: list[IncidentStatus] = Field(
        default_factory=lambda: [IncidentStatus.OPEN, IncidentStatus.INVESTIGATING]
    )
    criticality: list[Criticality] = Field(default_factory=list)
    category: list[IncidentCategory] = Field(default_factory=list)
    q: str | None = Field(default=None, min_length=1, max_length=100, description="Busca textual")
    limit: int = Field(default=100, ge=1, le=200)
    # Teto explícito: sem ele, um offset gigante chegava ao MySQL e virava erro 500
    # (encontrado pelo Schemathesis com offset = 2^64).
    offset: int = Field(default=0, ge=0, le=MAX_OFFSET)


class UserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str


class IncidentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    category: IncidentCategory
    criticality: Criticality
    status: IncidentStatus
    vehicle_plate: str
    highway: str
    km: Kilometer
    city: str
    state: str
    reported_at: UtcDatetime
    assigned_to: UserSummary | None
    assigned_at: UtcDatetime | None
    resolution_note: str | None
    version: int
    created_at: UtcDatetime
    updated_at: UtcDatetime


class ReleaseRequest(StrictInput):
    version: Version
    note: Annotated[str, Field(max_length=500)] | None = None


class TransitionRequest(StrictInput):
    """Fechar, marcar como inconclusivo ou reabrir. Assumir e liberar têm ações próprias."""

    version: Version
    to_status: IncidentStatus
    note: Annotated[str, Field(min_length=5, max_length=2000)] = Field(
        description="Resolução (ao fechar/inconclusivo) ou motivo (ao reabrir). Obrigatória."
    )


class IncidentEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: IncidentEventType
    from_status: IncidentStatus | None
    to_status: IncidentStatus | None
    note: str | None
    user: UserSummary | None
    created_at: UtcDatetime


class IncidentList(BaseModel):
    items: list[IncidentRead]
    total: int
    limit: int
    offset: int


class CriticalityCount(BaseModel):
    HIGH: int = 0
    MEDIUM: int = 0
    LOW: int = 0


class IncidentSummary(BaseModel):
    """Contadores para os cards do topo do painel."""

    by_status: dict[IncidentStatus, int]
    open_by_criticality: CriticalityCount
    investigating_by_criticality: CriticalityCount
