import pyodbc
from flask import current_app, g
from werkzeug.security import generate_password_hash


def _normalize_connection_string(conn_str):
    """Adapte les booléens ODBC courants pour le driver SQL Server."""
    conn_str = conn_str.strip()
    if len(conn_str) >= 2 and conn_str[0] == conn_str[-1] and conn_str[0] in {'"', "'"}:
        conn_str = conn_str[1:-1].strip()

    alias_map = {
        'initial catalog': 'Database',
        'user id': 'UID',
        'uid': 'UID',
        'password': 'PWD',
        'pwd': 'PWD',
    }

    parts = []
    seen_keys = set()
    for raw_part in conn_str.split(';'):
        part = raw_part.strip()
        if not part:
            continue

        key, sep, value = part.partition('=')
        if not sep:
            parts.append(part)
            continue

        normalized_key = key.strip().lower()
        output_key = alias_map.get(normalized_key, key.strip())
        normalized_value = value.strip()

        if normalized_key in {'encrypt', 'trustservercertificate'}:
            lowered = normalized_value.lower()
            if lowered in {'0', 'false', 'no'}:
                normalized_value = 'no'
            elif lowered in {'1', 'true', 'yes'}:
                normalized_value = 'yes'

        seen_keys.add(output_key.lower())
        parts.append(f"{output_key}={normalized_value}")

    if 'trustservercertificate' not in seen_keys:
        parts.append('TrustServerCertificate=yes')

    return ';'.join(parts)


def _build_connection_string(conn_str):
    conn_str = _normalize_connection_string(conn_str)
    if 'Driver=' not in conn_str:
        conn_str = f"Driver={{ODBC Driver 18 for SQL Server}};{conn_str}"
    return conn_str


def open_connection(conn_str):
    return pyodbc.connect(_build_connection_string(conn_str), timeout=30)


def ensure_auth_schema(app):
    """Ajoute les colonnes d'auth locale et seed l'admin par defaut si necessaire."""
    conn = open_connection(app.config['CONNECT_STRING'])
    try:
        cursor = conn.cursor()
        cursor.execute("IF COL_LENGTH('dbo.[User]', 'PasswordHash') IS NULL ALTER TABLE dbo.[User] ADD PasswordHash NVARCHAR(255) NULL;")
        cursor.execute("IF COL_LENGTH('dbo.[User]', 'RoleName') IS NULL ALTER TABLE dbo.[User] ADD RoleName NVARCHAR(50) NULL;")
        cursor.execute("IF COL_LENGTH('dbo.Reservation', 'GuestOwnerToken') IS NULL ALTER TABLE dbo.Reservation ADD GuestOwnerToken NVARCHAR(80) NULL;")
        cursor.execute("UPDATE dbo.[User] SET RoleName = CASE WHEN IsAdmin = 1 THEN 'admin' ELSE 'user' END WHERE RoleName IS NULL;")

        admin_name = app.config.get('LOCAL_ADMIN_NAME', 'Jeremy')
        admin_email = app.config.get('LOCAL_ADMIN_EMAIL', 'jeremy@bikeflow.local').strip().lower()
        admin_password = app.config.get('LOCAL_ADMIN_PASSWORD', 'JeremyBike26!')
        password_hash = generate_password_hash(admin_password)

        cursor.execute("SELECT UserId FROM dbo.[User] WHERE LOWER(UserEmail) = ?", admin_email)
        row = cursor.fetchone()
        if row:
            cursor.execute(
                """
                UPDATE dbo.[User]
                SET UserName = ?, IsAdmin = 1, RoleName = 'admin', PasswordHash = ?
                WHERE UserId = ?
                """,
                admin_name,
                password_hash,
                row.UserId,
            )
        else:
            cursor.execute(
                """
                INSERT INTO dbo.[User] (UserName, UserEmail, IsAdmin, RoleName, PasswordHash)
                VALUES (?, ?, 1, 'admin', ?)
                """,
                admin_name,
                admin_email,
                password_hash,
            )
        conn.commit()
    finally:
        conn.close()


def get_db():
    """Ouvre une connexion pyodbc pour la durée de la requête."""
    if 'db' not in g:
        g.db = open_connection(current_app.config['CONNECT_STRING'])
    return g.db


def close_db(e=None):
    """Ferme la connexion en fin de requête."""
    db = g.pop('db', None)
    if db is not None:
        db.close()
