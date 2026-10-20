def test_health_returns_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_accepts_head_requests_used_by_uptime_monitors(anonymous_client):
    response = anonymous_client.head("/api/health")

    assert response.status_code == 200
    assert response.content == b""
