from flask import Blueprint, jsonify, request, abort
from werkzeug.security import check_password_hash, generate_password_hash
from ..db import get_db

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


def _row_to_dict(row):
    role_name = getattr(row, 'RoleName', None) or ('admin' if bool(row.IsAdmin) else 'user')
    return {
        'user_id': row.UserId,
        'user_name': row.UserName,
        'user_email': row.UserEmail,
        'is_admin': bool(row.IsAdmin),
        'role_name': role_name,
    }


@auth_bp.post('/login')
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get('email') or '').strip().lower()
    password = str(data.get('password') or '')

    if not email or not password:
        abort(400, description='email et password sont requis.')

    cursor = get_db().cursor()
    cursor.execute(
        "SELECT UserId, UserName, UserEmail, IsAdmin, RoleName, PasswordHash FROM dbo.[User] WHERE LOWER(UserEmail) = ?",
        email,
    )
    row = cursor.fetchone()
    if not row or not row.PasswordHash or not check_password_hash(row.PasswordHash, password):
        abort(401, description='Identifiants invalides.')

    return jsonify(_row_to_dict(row))


@auth_bp.post('/register')
def register():
    data = request.get_json(silent=True) or {}
    user_name = str(data.get('user_name') or '').strip()
    user_email = str(data.get('user_email') or '').strip().lower()
    password = str(data.get('password') or '')

    if not user_name or not user_email or not password:
        abort(400, description='user_name, user_email et password sont requis.')
    if len(password) < 8:
        abort(400, description='Le mot de passe doit contenir au moins 8 caracteres.')

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT UserId FROM dbo.[User] WHERE LOWER(UserEmail) = ?", user_email)
    if cursor.fetchone():
        abort(409, description='Un compte existe deja avec cet email.')

    password_hash = generate_password_hash(password)
    cursor.execute(
        """
        INSERT INTO dbo.[User] (UserName, UserEmail, IsAdmin, RoleName, PasswordHash)
        OUTPUT INSERTED.UserId
        VALUES (?, ?, 0, 'user', ?)
        """,
        user_name,
        user_email,
        password_hash,
    )
    new_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute(
        "SELECT UserId, UserName, UserEmail, IsAdmin, RoleName FROM dbo.[User] WHERE UserId = ?",
        new_id,
    )
    return jsonify(_row_to_dict(cursor.fetchone())), 201