"""Envoi d'emails via SMTP.

Configuration via variables d'environnement :
- SMTP_HOST, SMTP_PORT (défaut 587), SMTP_USER, SMTP_PASSWORD
- SMTP_FROM (adresse expéditeur, défaut: SMTP_USER ou no-reply@bikeflow.local)
- SMTP_USE_TLS (défaut "1")
- RESERVATION_NOTIFY_EMAIL (défaut db@elcia.com)
- MAINTENANCE_EMAIL (défaut db@elcia.com)

Si SMTP_HOST n'est pas configuré, les fonctions loggent et renvoient False
sans lever d'exception (mode dégradé pour le dev).
"""
import os
import smtplib
import logging
from email.message import EmailMessage

logger = logging.getLogger(__name__)


def _smtp_config():
    return {
        'host': os.environ.get('SMTP_HOST'),
        'port': int(os.environ.get('SMTP_PORT', '587')),
        'user': os.environ.get('SMTP_USER'),
        'password': os.environ.get('SMTP_PASSWORD'),
        'from': os.environ.get('SMTP_FROM') or os.environ.get('SMTP_USER') or 'no-reply@bikeflow.local',
        'use_tls': os.environ.get('SMTP_USE_TLS', '1') == '1',
    }


def get_reservation_notify_email():
    return os.environ.get('RESERVATION_NOTIFY_EMAIL', 'db@elcia.com')


def get_maintenance_email():
    return os.environ.get('MAINTENANCE_EMAIL', 'db@elcia.com')


def send_email(to_addr, subject, body, attachments=None):
    """Envoie un email texte avec pièces jointes optionnelles.

    attachments : liste de tuples (filename, bytes, mimetype).
    Retourne True si envoyé, False si SMTP non configuré ou en erreur.
    """
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
