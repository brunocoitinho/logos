from fastapi.testclient import TestClient

from app.main import create_app


def test_unknown_route_uses_standard_error_format(client):
    response = client.get("/api/rota-que-nao-existe")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "NOT_FOUND", "message": "Recurso não encontrado."}}


def test_method_not_allowed_uses_standard_error_format(client):
    response = client.put("/api/incidents")

    assert response.status_code == 405
    assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


def test_unexpected_error_returns_500_without_internal_details():
    app = create_app()

    @app.get("/api/explode")
    def explode():
        raise RuntimeError("senha do banco: segredo123")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/api/explode")

    assert response.status_code == 500
    assert response.json()["error"]["code"] == "INTERNAL_ERROR"
    assert "segredo123" not in response.text
    assert "Traceback" not in response.text
