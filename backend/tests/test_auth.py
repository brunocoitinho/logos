from datetime import timedelta
from unittest.mock import patch

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.core.rate_limit import LoginRateLimiter
from app.core.security import create_access_token
from app.main import app, create_app
from app.models import IncidentEvent
from app.models.enums import IncidentEventType
from tests.factories import TEST_PASSWORD, create_incident, create_user


def login(client, email="ana@logos.test", password=TEST_PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_login_returns_token_that_authenticates(anonymous_client, analyst):
    response = login(anonymous_client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 480 * 60
    assert body["user"] == {"id": analyst.id, "name": "Ana Souza", "email": "ana@logos.test"}

    me = anonymous_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["id"] == analyst.id


def test_login_ignores_email_case_and_spaces(anonymous_client, analyst):
    response = login(anonymous_client, email="  ANA@Logos.Test ")

    assert response.status_code == 200


# S2 — mesma resposta para e-mail inexistente e senha errada
def test_login_failure_does_not_reveal_which_emails_exist(anonymous_client, analyst):
    wrong_password = login(anonymous_client, password="senha-errada")
    unknown_email = login(anonymous_client, email="ninguem@logos.test")

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()
    assert wrong_password.json()["error"]["message"] == "E-mail ou senha inválidos."


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "ana@logos.test"},
        {"password": "x"},
        {"email": "ana@logos.test", "password": ""},
        {"email": "ana@logos.test", "password": "x", "role": "admin"},
        {"email": "ana@logos.test", "password": "x" * 73},
    ],
)
def test_login_validates_payload(anonymous_client, payload):
    response = anonymous_client.post("/api/auth/login", json=payload)

    assert response.status_code == 422


# S1 — token ausente, inválido, adulterado ou expirado
def test_request_without_token_returns_401(anonymous_client):
    response = anonymous_client.get("/api/incidents")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.parametrize(
    "authorization",
    [
        "Bearer",
        "Bearer token-qualquer",
        "Token abc.def.ghi",
        "Basic YW5hOnNlbmhh",
    ],
)
def test_malformed_authorization_returns_401(anonymous_client, authorization):
    response = anonymous_client.get("/api/incidents", headers={"Authorization": authorization})

    assert response.status_code == 401


def test_token_signed_with_another_secret_returns_401(anonymous_client, analyst):
    forged = jwt.encode(
        {"sub": str(analyst.id), "exp": 9999999999},
        "outro-segredo-qualquer-com-32-chars",
        algorithm="HS256",
    )

    response = anonymous_client.get("/api/incidents", headers={"Authorization": f"Bearer {forged}"})

    assert response.status_code == 401


def test_expired_token_returns_401(anonymous_client, analyst):
    expired = create_access_token(analyst.id, expires_in=timedelta(seconds=-1))

    response = anonymous_client.get(
        "/api/incidents", headers={"Authorization": f"Bearer {expired}"}
    )

    assert response.status_code == 401


def test_token_of_removed_user_returns_401(anonymous_client, db, analyst):
    token = create_access_token(analyst.id)
    db.delete(analyst)
    db.commit()

    response = anonymous_client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/incidents"),
        ("GET", "/api/incidents/summary"),
        ("GET", "/api/incidents/1"),
        ("POST", "/api/incidents"),
        ("PATCH", "/api/incidents/1"),
        ("DELETE", "/api/incidents/1?version=1"),
        ("GET", "/api/auth/me"),
    ],
)
def test_protected_routes_require_token(anonymous_client, method, path):
    response = anonymous_client.request(method, path, json={})

    assert response.status_code == 401


def test_public_routes_do_not_require_token(anonymous_client):
    assert anonymous_client.get("/api/health").status_code == 200
    assert anonymous_client.get("/docs").status_code == 200


# S3 — limite de tentativas de login
def test_login_is_blocked_after_five_failures(anonymous_client, analyst):
    for _ in range(5):
        assert login(anonymous_client, password="errada").status_code == 401

    blocked = login(anonymous_client, password="errada")
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0

    # Nem a senha certa passa durante o bloqueio: o atacante não sabe quando acertou.
    assert login(anonymous_client).status_code == 429


def test_block_applies_only_to_the_attacked_email(anonymous_client, db, analyst):
    create_user(db, email="bruno@logos.test")
    for _ in range(5):
        login(anonymous_client, password="errada")

    assert login(anonymous_client, email="bruno@logos.test").status_code == 200


def test_successful_login_resets_failure_count(anonymous_client, analyst):
    for _ in range(4):
        login(anonymous_client, password="errada")
    assert login(anonymous_client).status_code == 200

    for _ in range(4):
        login(anonymous_client, password="errada")
    assert login(anonymous_client).status_code == 200


def test_rate_limiter_releases_after_window(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr("app.core.rate_limit.time.monotonic", lambda: clock[0])
    limiter = LoginRateLimiter(max_failures=2, window_seconds=60)

    limiter.register_failure("ip:email")
    limiter.register_failure("ip:email")
    assert limiter.retry_after("ip:email") == 60

    clock[0] += 61
    assert limiter.retry_after("ip:email") == 0


# S4 — CORS restrito às origens configuradas
def test_cors_allows_configured_origin(anonymous_client):
    response = anonymous_client.options(
        "/api/incidents",
        headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"},
    )

    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_cors_rejects_unknown_origin(anonymous_client):
    response = anonymous_client.options(
        "/api/incidents",
        headers={
            "Origin": "https://site-malicioso.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert "access-control-allow-origin" not in response.headers


# Rastreabilidade: o histórico registra quem agiu
def test_events_record_the_authenticated_analyst(client, db, analyst):
    created = client.post(
        "/api/incidents",
        json={
            "title": "Pneu furado",
            "category": "MECHANICAL_FAILURE",
            "criticality": "LOW",
            "vehicle_plate": "ABC1D23",
            "highway": "BR-116",
            "km": 10,
            "city": "Resende",
            "state": "RJ",
        },
    ).json()
    client.patch(f"/api/incidents/{created['id']}", json={"version": 1, "title": "Pneu trocado"})

    events = db.scalars(select(IncidentEvent).order_by(IncidentEvent.id)).all()
    assert [(event.type, event.user_id) for event in events] == [
        (IncidentEventType.CREATED, analyst.id),
        (IncidentEventType.UPDATED, analyst.id),
    ]


def test_other_analyst_can_read_incidents(db):
    other = create_user(db)
    create_incident(db)
    other_client = TestClient(
        app, headers={"Authorization": f"Bearer {create_access_token(other.id)}"}
    )

    assert other_client.get("/api/incidents").json()["total"] == 1


def test_production_requires_real_jwt_secret():
    with pytest.raises(ValidationError):
        Settings(environment="production")

    with pytest.raises(ValidationError):
        Settings(environment="production", jwt_secret="curto")

    Settings(environment="production", jwt_secret="x" * 32)


def test_cors_regex_allows_dynamic_preview_origins():
    """Prévias de PR da Vercel têm URL nova a cada deploy: liberadas por padrão, não por lista."""
    settings = Settings(
        cors_origins="https://logos.startbc.online",
        cors_origin_regex=r"https://logos-[a-z0-9-]+-time\.vercel\.app",
    )
    get_settings.cache_clear()
    try:
        with patch("app.main.get_settings", return_value=settings):
            client = TestClient(create_app())
    finally:
        get_settings.cache_clear()

    def preflight(origin: str):
        return client.options(
            "/api/incidents",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )

    preview = "https://logos-git-feat-x-time.vercel.app"
    assert preflight(preview).headers.get("access-control-allow-origin") == preview
    assert (
        "access-control-allow-origin" not in preflight("https://logos-x-outro.vercel.app").headers
    )
    assert "access-control-allow-origin" not in preflight("https://malicioso.example").headers


def test_empty_cors_regex_means_no_pattern():
    assert Settings(cors_origin_regex="").cors_origin_regex is None
    assert Settings(cors_origin_regex="   ").cors_origin_regex is None
    assert Settings().cors_origin_regex is None
