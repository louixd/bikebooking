from flask import Blueprint, jsonify, abort, request
from ..db import get_db

bikes_bp = Blueprint('bikes', __name__, url_prefix='/bikes')


def _row_to_dict(row):
    return {
        'bike_id': row.BikeId,
        'bike_name': row.BikeName,
        'bike_size': row.BikeSize,
        'bike_code': row.BikeCode,
        'bike_description': row.BikeDescription,
        'is_available': bool(row.IsAvailable),
    }


@bikes_bp.get('/')
@bikes_bp.get('')
def get_bikes():
    """Retourne la liste de tous les vélos."""
    cursor = get_db().cursor()
    cursor.execute("SELECT BikeId, BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable FROM dbo.Bike ORDER BY BikeId")
    bikes = [_row_to_dict(r) for r in cursor.fetchall()]
    return jsonify(bikes)


@bikes_bp.get('/<int:bike_id>')
def get_bike(bike_id):
    """Retourne le détail d'un vélo ou 404."""
    cursor = get_db().cursor()
    cursor.execute(
        "SELECT BikeId, BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable FROM dbo.Bike WHERE BikeId = ?",
        bike_id
    )
    row = cursor.fetchone()
    if not row:
        abort(404, description="Vélo introuvable.")
    return jsonify(_row_to_dict(row))


@bikes_bp.post('/')
@bikes_bp.post('')
def create_bike():
    """Crée un nouveau vélo."""
    data = request.get_json()
    required = ['bike_name', 'bike_code', 'bike_size']
    if not data or not all(k in data for k in required):
        abort(400, description=f"Champs requis : {required}")

    conn = get_db()
    cursor = conn.cursor()

    # Vérifier unicité du code
    cursor.execute("SELECT BikeId FROM dbo.Bike WHERE BikeCode = ?", data['bike_code'])
    if cursor.fetchone():
        abort(409, description="Ce code vélo existe déjà.")

    cursor.execute("""
        INSERT INTO dbo.Bike (BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable)
        OUTPUT INSERTED.BikeId
        VALUES (?, ?, ?, ?, 1)
    """, data['bike_name'], data['bike_size'], data['bike_code'],
         data.get('bike_description', ''))
    new_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute(
        "SELECT BikeId, BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable FROM dbo.Bike WHERE BikeId = ?",
        new_id
    )
    return jsonify(_row_to_dict(cursor.fetchone())), 201
