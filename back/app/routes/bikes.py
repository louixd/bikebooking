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

    try:
        quantity = int(data['bike_quantity']) if 'bike_quantity' in data else 1
    except (TypeError, ValueError):
        abort(400, description="La quantité doit être un nombre entier.")
    if quantity < 1 or quantity > 50:
        abort(400, description="La quantité doit être comprise entre 1 et 50.")

    base_code = data['bike_code'].strip()
    if not base_code:
        abort(400, description="Le code vélo est requis.")
    codes = [base_code] if quantity == 1 else [f"{base_code}-{i:02d}" for i in range(1, quantity + 1)]

    conn = get_db()
    cursor = conn.cursor()

    # Vérifier unicité du code
    placeholders = ','.join('?' for _ in codes)
    cursor.execute(f"SELECT BikeCode FROM dbo.Bike WHERE BikeCode IN ({placeholders})", *codes)
    existing_codes = [row.BikeCode for row in cursor.fetchall()]
    if existing_codes:
        abort(409, description="Ce code vélo existe déjà.")

    new_ids = []
    for index, code in enumerate(codes, start=1):
        bike_name = data['bike_name'].strip()
        if quantity > 1:
            bike_name = f"{bike_name} {index:02d}"
        cursor.execute("""
            INSERT INTO dbo.Bike (BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable)
            OUTPUT INSERTED.BikeId
            VALUES (?, ?, ?, ?, 1)
        """, bike_name, data['bike_size'], code, data.get('bike_description', ''))
        new_ids.append(cursor.fetchone()[0])
    conn.commit()

    placeholders = ','.join('?' for _ in new_ids)
    cursor.execute(
        f"SELECT BikeId, BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable FROM dbo.Bike WHERE BikeId IN ({placeholders}) ORDER BY BikeId",
        *new_ids
    )
    created = [_row_to_dict(row) for row in cursor.fetchall()]
    return jsonify(created[0] if quantity == 1 else {'created': created, 'quantity': len(created)}), 201


@bikes_bp.patch('/<int:bike_id>')
def update_bike(bike_id):
    """Met à jour les informations d'un vélo."""
    data = request.get_json(silent=True) or {}
    allowed_fields = {'bike_name', 'bike_code', 'bike_size', 'bike_description', 'is_available'}
    if not any(field in data for field in allowed_fields):
        abort(400, description="Aucun champ vélo à modifier.")

    bike_name = data.get('bike_name')
    bike_code = data.get('bike_code')
    bike_size = data.get('bike_size')
    bike_description = data.get('bike_description')
    is_available = data.get('is_available')

    if bike_name is not None and not str(bike_name).strip():
        abort(400, description="Le nom du vélo est requis.")
    if bike_code is not None and not str(bike_code).strip():
        abort(400, description="Le code vélo est requis.")
    if bike_size is not None and not str(bike_size).strip():
        abort(400, description="La taille du vélo est requise.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT BikeId FROM dbo.Bike WHERE BikeId = ?", bike_id)
    if not cursor.fetchone():
        abort(404, description="Vélo introuvable.")

    if bike_code is not None:
        cursor.execute("SELECT BikeId FROM dbo.Bike WHERE BikeCode = ? AND BikeId <> ?", str(bike_code).strip(), bike_id)
        if cursor.fetchone():
            abort(409, description="Ce code vélo existe déjà.")

    updates = []
    params = []
    if bike_name is not None:
        updates.append("BikeName = ?")
        params.append(str(bike_name).strip())
    if bike_size is not None:
        updates.append("BikeSize = ?")
        params.append(str(bike_size).strip())
    if bike_code is not None:
        updates.append("BikeCode = ?")
        params.append(str(bike_code).strip())
    if bike_description is not None:
        updates.append("BikeDescription = ?")
        params.append(str(bike_description).strip())
    if is_available is not None:
        updates.append("IsAvailable = ?")
        params.append(1 if bool(is_available) else 0)

    params.append(bike_id)
    cursor.execute(f"UPDATE dbo.Bike SET {', '.join(updates)} WHERE BikeId = ?", *params)
    conn.commit()

    cursor.execute(
        "SELECT BikeId, BikeName, BikeSize, BikeCode, BikeDescription, IsAvailable FROM dbo.Bike WHERE BikeId = ?",
        bike_id
    )
    return jsonify(_row_to_dict(cursor.fetchone()))


@bikes_bp.delete('/<int:bike_id>')
def delete_bike(bike_id):
    """Supprime un vélo s'il n'est pas actuellement réservé."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT BikeId FROM dbo.Bike WHERE BikeId = ?", bike_id)
    if not cursor.fetchone():
        abort(404, description="Vélo introuvable.")

    cursor.execute("SELECT COUNT(*) FROM dbo.Reservation WHERE BikeId = ? AND IsValidate = 1", bike_id)
    if cursor.fetchone()[0] > 0:
        abort(409, description="Impossible de supprimer ce vélo : il est en cours de réservation.")

    cursor.execute("DELETE FROM dbo.Bike WHERE BikeId = ?", bike_id)
    conn.commit()
    return jsonify({'message': 'Vélo supprimé.', 'bike_id': bike_id})
