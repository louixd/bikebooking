import secrets
from flask import Blueprint, current_app, jsonify, request, abort

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.post('/login')
def login_admin():
    """Valide le mot de passe d'administration."""
    data = request.get_json(silent=True) or {}
    password = str(data.get('password') or '')
    expected = str(current_app.config.get('ADMIN_PASSWORD') or '')

    if not expected:
        abort(503, description="Le mot de passe administrateur n'est pas configure.")

    if not password or not secrets.compare_digest(password, expected):
        abort(401, description="Mot de passe administrateur invalide.")

    return jsonify({'authenticated': True})