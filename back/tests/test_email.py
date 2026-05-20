from app.email import MAILJET_SMTP_HOST, _smtp_config


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
