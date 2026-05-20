from flask import Blueprint, abort

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.post('/login')
def login_admin():
    """Valide le mot de passe d'administration."""
    abort(410, description='La connexion administrateur locale est remplacee par Microsoft Entra ID.')
