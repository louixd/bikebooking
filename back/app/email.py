"""Envoi d'emails via SMTP ou Mailjet.

Configuration via variables d'environnement :
- SMTP_HOST, SMTP_PORT (défaut 587), SMTP_USER, SMTP_PASSWORD
- SMTP_FROM (adresse expéditeur, défaut: SMTP_USER ou no-reply@bikeflow.local)
- SMTP_USE_TLS (défaut "1")
- MAILJET_API_KEY, MAILJET_SECRET_KEY pour l'API Mailjet en déploiement
- MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE sont aussi acceptés
- MAILJET_FROM_EMAIL, MAILJET_FROM_NAME pour l'expéditeur Mailjet
- RESERVATION_NOTIFY_EMAIL (défaut db@elcia.com)
- MAINTENANCE_EMAIL (défaut db@elcia.com)

Si SMTP_HOST n'est pas configuré, les fonctions loggent et renvoient False
sans lever d'exception (mode dégradé pour le dev).
"""
import base64
import os
import smtplib
import logging
from email.message import EmailMessage
from mailjet_rest import Client

logger = logging.getLogger(__name__)

MAILJET_SMTP_HOST = 'in-v3.mailjet.com'


def _mailjet_from_address():
    email = os.environ.get('MAILJET_FROM_EMAIL')
    name = os.environ.get('MAILJET_FROM_NAME')
    if not email:
        return None
    if name:
        return f'{name} <{email}>'
    return email


def _mailjet_config():
    return {
        'api_key': os.environ.get('MAILJET_API_KEY') or os.environ.get('MJ_APIKEY_PUBLIC'),
        'secret_key': os.environ.get('MAILJET_SECRET_KEY') or os.environ.get('MJ_APIKEY_PRIVATE'),
        'from_email': os.environ.get('MAILJET_FROM_EMAIL') or os.environ.get('SMTP_FROM') or 'no-reply@bikeflow.local',
        'from_name': os.environ.get('MAILJET_FROM_NAME') or 'BikeFlow',
    }


def _uses_mailjet_api():
    cfg = _mailjet_config()
    return bool(cfg['api_key'] and cfg['secret_key'] and not os.environ.get('SMTP_HOST'))


def _smtp_config():
    mailjet_cfg = _mailjet_config()
    use_mailjet = bool(mailjet_cfg['api_key'] and mailjet_cfg['secret_key'] and not os.environ.get('SMTP_HOST'))

    return {
        'host': os.environ.get('SMTP_HOST') or (MAILJET_SMTP_HOST if use_mailjet else None),
        'port': 587 if use_mailjet else int(os.environ.get('SMTP_PORT', '587')),
        'user': os.environ.get('SMTP_USER') or (mailjet_cfg['api_key'] if use_mailjet else None),
        'password': os.environ.get('SMTP_PASSWORD') or (mailjet_cfg['secret_key'] if use_mailjet else None),
        'from': os.environ.get('SMTP_FROM') or _mailjet_from_address() or os.environ.get('SMTP_USER') or 'no-reply@bikeflow.local',
        'use_tls': True if use_mailjet else os.environ.get('SMTP_USE_TLS', '1') == '1',
    }


def _mailjet_attachment(filename, data, mimetype):
    return {
        'ContentType': mimetype or 'application/octet-stream',
        'Filename': filename,
        'Base64Content': base64.b64encode(data).decode('ascii'),
    }


def _send_mailjet_email(to_addr, subject, body, attachments=None):
    cfg = _mailjet_config()
    mailjet = Client(auth=(cfg['api_key'], cfg['secret_key']), version='v3.1')
    message = {
        'From': {
            'Email': cfg['from_email'],
            'Name': cfg['from_name'],
        },
        'To': [{'Email': to_addr}],
        'Subject': subject,
        'TextPart': body,
    }
    prepared_attachments = [
        _mailjet_attachment(filename, data, mimetype)
        for filename, data, mimetype in attachments or []
    ]
    if prepared_attachments:
        message['Attachments'] = prepared_attachments

    result = mailjet.send.create(data={'Messages': [message]})
    if 200 <= result.status_code < 300:
        logger.info("Email Mailjet envoyé à %s : %s", to_addr, subject)
        return True
    logger.error("Échec Mailjet email à %s : status %s %s", to_addr, result.status_code, result.json())
    return False


def get_reservation_notify_email():
    return os.environ.get('RESERVATION_NOTIFY_EMAIL', 'db@elcia.com')


def get_maintenance_email():
    return os.environ.get('MAINTENANCE_EMAIL', 'db@elcia.com')


def send_email(to_addr, su_uses_mailjet_apibject, body, attachments=None):
    """Envoie un email texte avec pièces jointes optionnelles.

    attachments : liste de tuples (filename, bytes, mimetype).
    Retourne True si envoyé, False si SMTP non configuré ou en erreur.
    """
    if _uses_mailjet_api():
        try:
            return _send_mailjet_email(to_addr, subject, body, attachments)
        except Exception as exc:
            logger.error("Échec envoi Mailjet à %s : %s", to_addr, exc)
            return False

    cfg = _smtp_config()
    if not cfg['host']:
        logger.warning("SMTP non configuré — email '%s' à %s ignoré.", subject, to_addr)
        return False

    msg = EmailMessage()
    msg['From'] = cfg['from']
    msg['To'] = to_addr
    msg['Subject'] = subject
    msg.set_content(body)

    for filename, data, mime in attachments or []:
        maintype, _, subtype = (mime or 'application/octet-stream').partition('/')
        msg.add_attachment(data, maintype=maintype, subtype=subtype or 'octet-stream', filename=filename)

    try:
        with smtplib.SMTP(cfg['host'], cfg['port'], timeout=15) as smtp:
            if cfg['use_tls']:
                smtp.starttls()
            if cfg['user'] and cfg['password']:
                smtp.login(cfg['user'], cfg['password'])
            smtp.send_message(msg)
        logger.info("Email envoyé à %s : %s", to_addr, subject)
        return True
    except Exception as exc:
        logger.error("Échec envoi email à %s : %s", to_addr, exc)
        return False
