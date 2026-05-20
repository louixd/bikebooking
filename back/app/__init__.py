from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
from .db import close_db, database_url_from_env, ensure_auth_schema

DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://bikebooking-akyr.onrender.com',
]


def _allowed_origins():
    raw_origins = ','.join([
        ','.join(DEFAULT_ALLOWED_ORIGINS),
        os.environ.get('ALLOWED_ORIGIN', ''),
        os.environ.get('ALLOWED_ORIGINS', ''),
    ])
    origins = []
    for origin in raw_origins.split(','):
        origin = origin.strip()
        if origin and origin not in origins:
            origins.append(origin)
    return origins


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config['DATABASE_URL'] = database_url_from_env()
    app.config['ALLOWED_ORIGINS'] = _allowed_origins()
    app.config['ENTRA_TENANT_ID'] = os.environ.get('ENTRA_TENANT_ID') or os.environ.get('AZURE_TENANT_ID')
    app.config['ENTRA_CLIENT_ID'] = os.environ.get('ENTRA_CLIENT_ID') or os.environ.get('AZURE_CLIENT_ID')
    app.config['ENTRA_ADMIN_EMAILS'] = os.environ.get('ENTRA_ADMIN_EMAILS', '')
    app.config['ENTRA_ADMIN_OBJECT_IDS'] = os.environ.get('ENTRA_ADMIN_OBJECT_IDS', '')

    CORS(app, origins=app.config['ALLOWED_ORIGINS'])

    from .routes.admin import admin_bp
    from .routes.auth import auth_bp
    from .routes.bikes import bikes_bp
    from .routes.users import users_bp
    from .routes.reservations import reservations_bp
    from .routes.returns import returns_bp
    from .routes.reparations import reparations_bp

    ensure_auth_schema(app)

    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(bikes_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(reservations_bp)
    app.register_blueprint(returns_bp)
    app.register_blueprint(reparations_bp)
    app.teardown_appcontext(close_db)

    return app
