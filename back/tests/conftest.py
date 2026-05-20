import pytest
from unittest.mock import MagicMock, patch
from app import create_app


@pytest.fixture
def app():
    """Crée l'app Flask en mode test avec DB mockée."""
    with patch('app.ensure_auth_schema'):
        application = create_app()
    application.config.update({
        'TESTING': True,
        'DATABASE_URL': 'postgresql://mock:mock@localhost/mock',
    })
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture(autouse=True)
def mock_db(app):
    """Mock global de get_db pour tous les tests."""
    with app.app_context():
        with patch('app.db.get_db') as mock:
            yield mock
