"""Gera dados fictícios e realistas de incidentes nas rodovias brasileiras.

Usado pelo seed (carga inicial) e pelo simulador de caminhões. Recebe um `random.Random`
para que os testes possam gerar sempre os mesmos dados (semente fixa).
"""

import random
import string
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

from app.models.enums import Criticality, IncidentCategory


@dataclass(frozen=True)
class RoadSegment:
    highway: str
    city: str
    state: str
    km_start: int
    km_end: int


ROAD_SEGMENTS = [
    RoadSegment("BR-116", "Resende", "RJ", 300, 330),
    RoadSegment("BR-116", "Barra Mansa", "RJ", 270, 299),
    RoadSegment("BR-116", "São José dos Campos", "SP", 140, 160),
    RoadSegment("BR-116", "Guarulhos", "SP", 210, 230),
    RoadSegment("BR-116", "Curitiba", "PR", 100, 125),
    RoadSegment("BR-116", "Feira de Santana", "BA", 420, 440),
    RoadSegment("BR-101", "Itaguaí", "RJ", 400, 420),
    RoadSegment("BR-101", "Joinville", "SC", 30, 50),
    RoadSegment("BR-101", "Florianópolis", "SC", 200, 220),
    RoadSegment("BR-101", "Serra", "ES", 260, 275),
    RoadSegment("BR-040", "Petrópolis", "RJ", 70, 90),
    RoadSegment("BR-040", "Juiz de Fora", "MG", 770, 790),
    RoadSegment("BR-381", "Betim", "MG", 480, 500),
    RoadSegment("BR-381", "Ipatinga", "MG", 270, 290),
    RoadSegment("BR-153", "Anápolis", "GO", 440, 460),
    RoadSegment("BR-163", "Sinop", "MT", 820, 840),
    RoadSegment("BR-163", "Campo Grande", "MS", 470, 490),
    RoadSegment("BR-277", "Paranaguá", "PR", 5, 25),
    RoadSegment("SP-330", "Campinas", "SP", 90, 110),
    RoadSegment("SP-348", "Jundiaí", "SP", 55, 70),
]

# (título, descrição) por categoria.
INCIDENT_TEMPLATES: dict[IncidentCategory, list[tuple[str, str]]] = {
    IncidentCategory.ACCIDENT_WITH_VICTIMS: [
        (
            "Colisão com feridos",
            "Colisão traseira entre o caminhão e um carro de passeio. "
            "Motorista relata dois feridos conscientes; SAMU acionado.",
        ),
        (
            "Atropelamento na pista",
            "Pedestre atingido ao atravessar a rodovia. Motorista parado no acostamento "
            "aguardando a PRF.",
        ),
        (
            "Tombamento com motorista ferido",
            "Caminhão tombou na curva. Motorista consciente, com ferimentos no braço.",
        ),
        (
            "Engavetamento com vítimas",
            "Engavetamento envolvendo três veículos. Há vítimas presas às ferragens.",
        ),
    ],
    IncidentCategory.VEHICLE_ACCIDENT: [
        (
            "Colisão leve sem feridos",
            "Batida lateral durante mudança de faixa. Sem feridos, avarias no para-choque.",
        ),
        (
            "Saída de pista",
            "Caminhão saiu da pista e parou no canteiro. Motorista sem ferimentos.",
        ),
        (
            "Colisão em manobra no posto",
            "Colisão com veículo estacionado ao manobrar no posto de combustível.",
        ),
        (
            "Carga deslocada após frenagem",
            "Frenagem brusca deslocou a carga e danificou a carroceria.",
        ),
    ],
    IncidentCategory.ADVERSE_WEATHER: [
        (
            "Neblina densa na serra",
            "Visibilidade abaixo de 50 metros. "
            "Motorista reduziu a velocidade e aguarda orientação.",
        ),
        (
            "Alagamento na pista",
            "Chuva forte provocou alagamento em duas faixas. Tráfego lento.",
        ),
        (
            "Granizo e pista escorregadia",
            "Chuva de granizo deixou a pista escorregadia. Motorista parado no acostamento.",
        ),
        (
            "Ventos fortes",
            "Rajadas de vento laterais dificultam o controle do veículo com baú vazio.",
        ),
    ],
    IncidentCategory.MECHANICAL_FAILURE: [
        (
            "Pneu furado",
            "Pneu do eixo traseiro furado. Motorista parado no acostamento sem estepe.",
        ),
        (
            "Superaquecimento do motor",
            "Painel indica superaquecimento. Motorista desligou o motor e aguarda socorro.",
        ),
        (
            "Falha no sistema de freios",
            "Perda de pressão no sistema de freio a ar. Veículo imobilizado.",
        ),
        (
            "Pane elétrica",
            "Veículo não liga após parada para descanso. Bateria aparentemente descarregada.",
        ),
        (
            "Vazamento de óleo",
            "Vazamento de óleo no motor identificado na parada de fiscalização.",
        ),
    ],
    IncidentCategory.ROAD_BLOCKED: [
        (
            "Bloqueio por manifestação",
            "Manifestantes bloqueiam as duas faixas. Sem previsão de liberação.",
        ),
        (
            "Interdição por acidente à frente",
            "Pista interditada pela PRF por acidente à frente. Fila de 5 km.",
        ),
        (
            "Queda de barreira",
            "Deslizamento de terra bloqueou parcialmente a pista após a chuva.",
        ),
        (
            "Obras com pare e siga",
            "Obra na pista com sistema pare e siga. Espera estimada de 40 minutos.",
        ),
    ],
}

# Quanto cada categoria aparece: problema mecânico é o mais comum, vítimas o mais raro.
CATEGORY_WEIGHTS: dict[IncidentCategory, int] = {
    IncidentCategory.MECHANICAL_FAILURE: 40,
    IncidentCategory.ROAD_BLOCKED: 20,
    IncidentCategory.VEHICLE_ACCIDENT: 17,
    IncidentCategory.ADVERSE_WEATHER: 15,
    IncidentCategory.ACCIDENT_WITH_VICTIMS: 8,
}

# Pesos (Alta, Média, Baixa) por categoria: acidente com vítimas tende a ser Alta.
CRITICALITY_WEIGHTS: dict[IncidentCategory, tuple[int, int, int]] = {
    IncidentCategory.ACCIDENT_WITH_VICTIMS: (80, 20, 0),
    IncidentCategory.VEHICLE_ACCIDENT: (30, 50, 20),
    IncidentCategory.ROAD_BLOCKED: (30, 50, 20),
    IncidentCategory.ADVERSE_WEATHER: (20, 50, 30),
    IncidentCategory.MECHANICAL_FAILURE: (5, 35, 60),
}

CRITICALITIES = (Criticality.HIGH, Criticality.MEDIUM, Criticality.LOW)


def generate_plate(rng: random.Random) -> str:
    """Placa no padrão Mercosul: três letras, um número, uma letra, dois números (ABC1D23)."""
    letters = "".join(rng.choices(string.ascii_uppercase, k=3))
    return (
        f"{letters}{rng.randint(0, 9)}{rng.choice(string.ascii_uppercase)}{rng.randint(0, 99):02d}"
    )


def generate_incident_data(rng: random.Random, reported_at: datetime) -> dict:
    """Dados de um incidente novo, prontos para criar um `Incident` ou enviar à API."""
    category = rng.choices(list(CATEGORY_WEIGHTS), weights=list(CATEGORY_WEIGHTS.values()))[0]
    criticality = rng.choices(CRITICALITIES, weights=CRITICALITY_WEIGHTS[category])[0]
    title, description = rng.choice(INCIDENT_TEMPLATES[category])
    segment = rng.choice(ROAD_SEGMENTS)
    km = Decimal(str(round(rng.uniform(segment.km_start, segment.km_end), 1)))

    return {
        "title": title,
        "description": description,
        "category": category,
        "criticality": criticality,
        "vehicle_plate": generate_plate(rng),
        "highway": segment.highway,
        "km": km,
        "city": segment.city,
        "state": segment.state,
        "reported_at": reported_at,
    }


def minutes_ago(now: datetime, rng: random.Random, minimum: int, maximum: int) -> datetime:
    return now - timedelta(minutes=rng.randint(minimum, maximum))
