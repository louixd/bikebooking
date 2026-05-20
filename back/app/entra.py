from functools import lru_cache

import jwt
from flask import abort, current_app, request
from jwt import InvalidTokenError, PyJWKClient
from jwt.exceptions import PyJWKClientError

from .db import get_db


def _split_config_list(value):
    return {item.strip().lower() for item in str(value or '').split(',') if item.strip()}


def _required_config():
    tenant_id = current_app.config.get('ENTRA_TENANT_ID')
    client_id = current_app.config.get('ENTRA_CLIENT_ID')
    if not tenant_id or not client_id:
        abort(503, description="La connexion Microsoft Entra ID n'est pas configuree.")
    return tenant_id, client_id


@lru_cache(maxsize=8)
def _jwks_client(tenant_id):
    return PyJWKClient(f'https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys')


def validate_entra_token(token):
    """Valide un ID token Microsoft Entra ID et retourne ses claims."""
    tenant_id, client_id = _required_config()
    if not token:
        abort(401, description='Jeton Microsoft manquant.')

    try:
        signing_key = _jwks_client(tenant_id).get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=['RS256'],
            audience=client_id,
            issuer=f'https://login.microsoftonline.com/{tenant_id}/v2.0',
        )
    except (InvalidTokenError, PyJWKClientError, ValueError):
        abort(401, description='Session Microsoft invalide ou expiree.')


def claims_to_user(claims):
    email = str(claims.get('email') or claims.get('preferred_username') or claims.get('upn') or '').strip().lower()
    name = str(claims.get('name') or email.split('@')[0] or 'Utilisateur').strip()
    object_id = str(claims.get('oid') or claims.get('sub') or '').strip()
    if not email:
        abort(400, description="Le compte Microsoft ne fournit pas d'adresse email exploitable.")

    admin_emails = _split_config_list(current_app.config.get('ENTRA_ADMIN_EMAILS'))
    admin_object_ids = _split_config_list(current_app.config.get('ENTRA_ADMIN_OBJECT_IDS'))
    is_admin = email in admin_emails or object_id.lower() in admin_object_ids
    return {
        'name': name,
        'email': email,
        'object_id': object_id,
        'is_admin': is_admin,
        'role_name': 'admin' if is_admin else 'user',
    }


def upsert_entra_user(claims):
    entra_user = claims_to_user(claims)
    conn = get_db()
    cursor = conn.cursor()

    row = None
    if entra_user['object_id']:
        cursor.execute(
            "SELECT UserId FROM dbo.[User] WHERE EntraObjectId = ?",
            entra_user['object_id'],
        )
        row = cursor.fetchone()

    if not row:
        cursor.execute(
            "SELECT UserId FROM dbo.[User] WHERE LOWER(UserEmail) = ?",
            entra_user['email'],
        )
        row = cursor.fetchone()

    if row:
        cursor.execute(
            """
            UPDATE dbo.[User]
            SET UserName = ?, UserEmail = ?, IsAdmin = ?, RoleName = ?, EntraObjectId = ?
            WHERE UserId = ?
            """,
            entra_user['name'],
            entra_user['email'],
            1 if entra_user['is_admin'] else 0,
            entra_user['role_name'],
            entra_user['object_id'] or None,
            row.UserId,
        )
        user_id = row.UserId
    else:
        cursor.execute(
            """
            INSERT INTO dbo.[User] (UserName, UserEmail, IsAdmin, RoleName, EntraObjectId)
            OUTPUT INSERTED.UserId
            VALUES (?, ?, ?, ?, ?)
            """,
            entra_user['name'],
            entra_user['email'],
            1 if entra_user['is_admin'] else 0,
            entra_user['role_name'],
            entra_user['object_id'] or None,
        )
        user_id = cursor.fetchone()[0]

    conn.commit()
    return {
        'user_id': user_id,
        'user_name': entra_user['name'],
        'user_email': entra_user['email'],
        'is_admin': entra_user['is_admin'],
        'role_name': entra_user['role_name'],
    }


def get_bearer_token():
    header = request.headers.get('Authorization', '')
    scheme, _, token = header.partition(' ')
    if scheme.lower() != 'bearer':
        return None
    return token.strip() or None


def get_entra_user_from_request(required=False):
    token = get_bearer_token()
    if not token:
        if required:
            abort(401, description='Connexion Microsoft requise.')
        return None
    return upsert_entra_user(validate_entra_token(token))