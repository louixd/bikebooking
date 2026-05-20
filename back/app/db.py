import os
import re
from collections.abc import Mapping
from flask import current_app, g
import psycopg
from psycopg.rows import dict_row
from werkzeug.security import generate_password_hash


class PgRow:
    def __init__(self, data):
        self._data = dict(data)
        self._values = list(data.values())

    def __getitem__(self, key):
        if isinstance(key, int):
            return self._values[key]
        return self._data[key]

    def __getattr__(self, name):
        lowered_name = name.lower()
        for key, value in self._data.items():
            if key.lower() == lowered_name:
                return value
        raise AttributeError(name)


class PgCursor:
    TABLE_REPLACEMENTS = {
        'dbo.[User]': 'app_user',
        'dbo.[Return]': 'bike_return',
        'dbo.Bike': 'bike',
        'dbo.Reservation': 'reservation',
        'dbo.Reparation': 'reparation',
    }

    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, query, *params):
        sql = self._prepare_sql(query)
        execute_params = self._prepare_params(params)
        self._cursor.execute(sql, execute_params)
        return self

    def fetchone(self):
        row = self._cursor.fetchone()
        return PgRow(row) if row is not None else None

    def fetchall(self):
        return [PgRow(row) for row in self._cursor.fetchall()]

    def close(self):
        self._cursor.close()

    def _prepare_params(self, params):
        if not params:
            return None
        if len(params) == 1 and isinstance(params[0], (tuple, list, Mapping)):
            return params[0]
        return params

    def _prepare_sql(self, query):
        sql = str(query)
        returning_match = re.search(r'\bOUTPUT\s+INSERTED\.(\w+)\b', sql, flags=re.IGNORECASE)
        if returning_match:
            returning_column = returning_match.group(1)
            sql = re.sub(r'\bOUTPUT\s+INSERTED\.\w+\b', '', sql, flags=re.IGNORECASE)
            sql = sql.rstrip().rstrip(';') + f' RETURNING {returning_column}'

        for source, target in self.TABLE_REPLACEMENTS.items():
            sql = sql.replace(source, target)

        return sql.replace('?', '%s')


class PgConnection:
    def __init__(self, connection):
        self._connection = connection

    def cursor(self):
        return PgCursor(self._connection.cursor())

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def close(self):
        self._connection.close()


def database_url_from_env():
    return os.environ.get('DATABASE_URL') or (
        f"postgresql://{os.environ.get('POSTGRES_USER', 'bikeflow')}:"
        f"{os.environ.get('POSTGRES_PASSWORD', 'bikeflow')}@"
        f"{os.environ.get('POSTGRES_HOST', 'localhost')}:"
        f"{os.environ.get('POSTGRES_PORT', '5432')}/"
        f"{os.environ.get('POSTGRES_DB', 'bikeflow')}"
    )


def open_connection(database_url=None):
    return PgConnection(psycopg.connect(database_url or database_url_from_env(), row_factory=dict_row))


def ensure_auth_schema(app):
    """Initialise le schema PostgreSQL et seed l'admin local par defaut."""
    conn = open_connection(app.config['DATABASE_URL'])
    try:
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_user (
                UserId SERIAL PRIMARY KEY,
                UserName VARCHAR(120) NOT NULL,
                UserEmail VARCHAR(255) NOT NULL UNIQUE,
                IsAdmin SMALLINT NOT NULL DEFAULT 0,
                RoleName VARCHAR(50),
                PasswordHash VARCHAR(255)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bike (
                BikeId SERIAL PRIMARY KEY,
                BikeName VARCHAR(120) NOT NULL,
                BikeSize VARCHAR(50) NOT NULL,
                BikeCode VARCHAR(80) NOT NULL UNIQUE,
                BikeDescription TEXT,
                IsAvailable SMALLINT NOT NULL DEFAULT 1
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reservation (
                ReservationId SERIAL PRIMARY KEY,
                ReservationCode VARCHAR(50) NOT NULL UNIQUE,
                ReservationDate TIMESTAMP NOT NULL,
                ReturnDate TIMESTAMP NOT NULL,
                IsValidate SMALLINT NOT NULL DEFAULT 1,
                UserId INTEGER REFERENCES app_user(UserId) ON DELETE SET NULL,
                UserNameFree VARCHAR(120),
                BikeId INTEGER REFERENCES bike(BikeId) ON DELETE SET NULL,
                GuestOwnerToken VARCHAR(80)
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS reparation (
                ReparationId SERIAL PRIMARY KEY,
                ReparationDescription TEXT NOT NULL,
                ReparationBeginDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ReparationEndDate TIMESTAMP,
                ReparationCost NUMERIC(10, 2),
                BikeId INTEGER REFERENCES bike(BikeId) ON DELETE SET NULL
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bike_return (
                ReturnId SERIAL PRIMARY KEY,
                ReservationId INTEGER REFERENCES reservation(ReservationId) ON DELETE SET NULL,
                ReturnDate TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ProblemState VARCHAR(120),
                ReturnState VARCHAR(40),
                ReturnComment TEXT,
                BikeId INTEGER REFERENCES bike(BikeId) ON DELETE SET NULL
            )
        """)
        cursor.execute("UPDATE app_user SET RoleName = CASE WHEN IsAdmin = 1 THEN 'admin' ELSE 'user' END WHERE RoleName IS NULL")

        admin_name = app.config.get('LOCAL_ADMIN_NAME', 'Jeremy')
        admin_email = app.config.get('LOCAL_ADMIN_EMAIL', 'jeremy@bikeflow.local').strip().lower()
        admin_password = app.config.get('LOCAL_ADMIN_PASSWORD', 'JeremyBike26!')
        password_hash = generate_password_hash(admin_password)

        cursor.execute("SELECT UserId FROM app_user WHERE LOWER(UserEmail) = %s", admin_email)
        row = cursor.fetchone()
        if row:
            cursor.execute(
                """
                UPDATE app_user
                SET UserName = %s, IsAdmin = 1, RoleName = 'admin', PasswordHash = %s
                WHERE UserId = %s
                """,
                admin_name,
                password_hash,
                row.UserId,
            )
        else:
            cursor.execute(
                """
                INSERT INTO app_user (UserName, UserEmail, IsAdmin, RoleName, PasswordHash)
                VALUES (%s, %s, 1, 'admin', %s)
                """,
                admin_name,
                admin_email,
                password_hash,
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_db():
    """Ouvre une connexion PostgreSQL pour la duree de la requete."""
    if 'db' not in g:
        g.db = open_connection(current_app.config['DATABASE_URL'])
    return g.db


def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()
