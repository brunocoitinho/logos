# Importar todos os models aqui garante que o Alembic e o SQLAlchemy enxerguem todas as tabelas.
from app.models.incident import Incident
from app.models.incident_event import IncidentEvent
from app.models.user import User

__all__ = ["Incident", "IncidentEvent", "User"]
