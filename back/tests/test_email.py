from unittest.mock import MagicMock, patch

from app.email import MAILJET_SMTP_HOST, _mailjet_config, _smtp_config, _uses_mailjet_api, send_email


def test_mailjet_config_is_used_when_keys_are_present(monkeypatch):
    monkeypatch.delenv('SMTP_HOST', raising=False)
    monkeypatch.delenv('SMTP_USER', raising=False)
    monkeypatch.delenv('SMTP_PASSWORD', raising=False)
    monkeypatch.delenv('SMTP_FROM', raising=False)
    monkeypatch.setenv('MAILJET_API_KEY', 'api-key')
    monkeypatch.setenv('MAILJET_SECRET_KEY', 'secret-key')
    monkeypatch.setenv('MAILJET_FROM_EMAIL', 'no-reply@example.com')
    monkeypatch.setenv('MAILJET_FROM_NAME', 'BikeFlow')

    config = _smtp_config()

    assert config['host'] == MAILJET_SMTP_HOST
    assert config['port'] == 587
    assert config['user'] == 'api-key'
    assert config['password'] == 'secret-key'
    assert config['from'] == 'BikeFlow <no-reply@example.com>'
    assert config['use_tls'] is True
    assert _uses_mailjet_api() is True


def test_mailjet_accepts_official_env_variable_names(monkeypatch):
    monkeypatch.delenv('MAILJET_API_KEY', raising=False)
    monkeypatch.delenv('MAILJET_SECRET_KEY', raising=False)
    monkeypatch.delenv('SMTP_HOST', raising=False)
    monkeypatch.setenv('MJ_APIKEY_PUBLIC', 'public-key')
    monkeypatch.setenv('MJ_APIKEY_PRIVATE', 'private-key')

    config = _mailjet_config()

    assert config['api_key'] == 'public-key'
    assert config['secret_key'] == 'private-key'
    assert _uses_mailjet_api() is True


def test_send_email_uses_mailjet_api_when_configured(monkeypatch):
    monkeypatch.delenv('SMTP_HOST', raising=False)
    monkeypatch.setenv('MAILJET_API_KEY', 'api-key')
    monkeypatch.setenv('MAILJET_SECRET_KEY', 'secret-key')
    monkeypatch.setenv('MAILJET_FROM_EMAIL', 'no-reply@example.com')
    monkeypatch.setenv('MAILJET_FROM_NAME', 'BikeFlow')
    mock_result = MagicMock(status_code=200)
    mock_mailjet = MagicMock()
    mock_mailjet.send.create.return_value = mock_result

    with patch('app.email.Client', return_value=mock_mailjet) as mock_client:
        sent = send_email('user@example.com', 'Sujet', 'Bonjour')

    assert sent is True
    mock_client.assert_called_once_with(auth=('api-key', 'secret-key'), version='v3.1')
    payload = mock_mailjet.send.create.call_args.kwargs['data']
    message = payload['Messages'][0]
    assert message['From'] == {'Email': 'no-reply@example.com', 'Name': 'BikeFlow'}
    assert message['To'] == [{'Email': 'user@example.com'}]
    assert message['Subject'] == 'Sujet'
    assert message['TextPart'] == 'Bonjour'


def test_smtp_host_overrides_mailjet_for_local_mailpit(monkeypatch):
    monkeypatch.setenv('SMTP_HOST', 'mailpit')
    monkeypatch.setenv('SMTP_PORT', '1025')
    monkeypatch.setenv('SMTP_USE_TLS', '0')
    monkeypatch.delenv('SMTP_USER', raising=False)
    monkeypatch.delenv('SMTP_PASSWORD', raising=False)
    monkeypatch.delenv('SMTP_FROM', raising=False)
    monkeypatch.setenv('MAILJET_API_KEY', 'api-key')
    monkeypatch.setenv('MAILJET_SECRET_KEY', 'secret-key')

    config = _smtp_config()

    assert config['host'] == 'mailpit'
    assert config['port'] == 1025
    assert config['user'] is None
    assert config['password'] is None
    assert config['use_tls'] is False
    assert _uses_mailjet_api() is False
