from flask import Blueprint, jsonify, request, abort
from ..db import get_db

users_bp = Blueprint('users', __name__, url_prefix='/users')


def _row_to_dict(row):
    return {
        'user_id': row.UserId,
        'user_name': row.UserName,
        'user_email': row.UserEmail,
        'is_admin': bool(row.IsAdmin),
        'role_name': getattr(row, 'RoleName', None) or ('admin' if bool(row.IsAdmin) else 'user'),
    }


@users_bp.get('/')
@users_bp.get('')
def get_users():
    """Retourne la liste de tous les utilisateurs."""
    cursor = get_db().cursor()
    cursor.execute("SELECT UserId, UserName, UserEmail, IsAdmin, RoleName FROM dbo.[User] ORDER BY UserId")
    return jsonify([_row_to_dict(r) for r in cursor.fetchall()])


@users_bp.post('/')
@users_bp.post('')
def create_user():
    """Crée un nouvel utilisateur."""
    data = request.get_json()
    if not data or not data.get('user_name') or not data.get('user_email'):
        abort(400, description="user_name et user_email sont requis.")

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO dbo.[User] (UserName, UserEmail, IsAdmin, RoleName) OUTPUT INSERTED.UserId VALUES (?, ?, 0, 'user')",
        data['user_name'], data['user_email']
    )
    new_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute("SELECT UserId, UserName, UserEmail, IsAdmin, RoleName FROM dbo.[User] WHERE UserId = ?", new_id)
    return jsonify(_row_to_dict(cursor.fetchone())), 201
