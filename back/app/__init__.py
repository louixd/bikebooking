from flask import Flask
from flask_cors import CORS
from dotenv import load_dotenv
import os
from .db import close_db, database_url_from_env, ensure_auth_schema


def _allowed_origins():
    raw_origins = os.environ.get('ALLOWED_ORIGINS') or os.environ.get('ALLOWED_ORIGIN', 'http://localhost:5173')
    return [origin.strip() for origin in raw_origins.split(',') if origin.strip()]


def create_app():
    load_dotenv()
    app = Flask(__name__)
    app.config['DATABASE_URL'] = database_url_from_env()
    app.config['ALLOWED_ORIGINS'] = _allowed_origins()
    app.config['ADMIN_PASSWORD'] = os.environ.get('ADMIN_PASSWORD', 'bikeflow-admin')
    app.config['LOCAL_ADMIN_NAME'] = os.environ.get('LOCAL_ADMIN_NAME', 'Jeremy')
    app.config['LOCAL_ADMIN_EMAIL'] = os.environ.get('LOCAL_ADMIN_EMAIL', 'jeremy@bikeflow.local')
    app.config['LOCAL_ADMIN_PASSWORD'] = os.environ.get('LOCAL_ADMIN_PASSWORD', 'JeremyBike26!')

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
