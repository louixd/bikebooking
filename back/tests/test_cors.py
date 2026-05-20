from unittest.mock import patch

from app import create_app


def test_render_front_origin_is_allowed_on_preflight(monkeypatch):
    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://localhost:5173,https://bikebooking-akyr.onrender.com')
    with patch('app.ensure_auth_schema'):
        application = create_app()

    client = application.test_client()
    response = client.options('/bikes', headers={
        'Origin': 'https://bikebooking-akyr.onrender.com',
        'Access-Control-Request-Method': 'GET',
    })

    assert response.status_code == 200
    assert response.headers['Access-Control-Allow-Origin'] == 'https://bikebooking-akyr.onrender.com'


def test_render_front_origin_is_allowed_with_legacy_localhost_env(monkeypatch):
    monkeypatch.delenv('ALLOWED_ORIGINS', raising=False)
    monkeypatch.setenv('ALLOWED_ORIGIN', 'http://localhost:5173')
    with patch('app.ensure_auth_schema'):
        application = create_app()

    client = application.test_client()
    response = client.options('/users', headers={
        'Origin': 'https://bikebooking-akyr.onrender.com',
        'Access-Control-Request-Method': 'GET',
    })

    assert response.status_code == 200
    assert response.headers['Access-Control-Allow-Origin'] == 'https://bikebooking-akyr.onrender.com'


def test_unlisted_origin_is_not_allowed_on_preflight(monkeypatch):
    monkeypatch.setenv('ALLOWED_ORIGINS', 'http://localhost:5173,https://bikebooking-akyr.onrender.com')
    with patch('app.ensure_auth_schema'):
        application = create_app()

    client = application.test_client()
    response = client.options('/bikes', headers={
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'GET',
    })

    assert 'Access-Control-Allow-Origin' not in response.headers
