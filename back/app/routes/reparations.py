from flask import Blueprint, jsonify, request, abort
from ..db import get_db

reparations_bp = Blueprint('reparations', __name__, url_prefix='/reparations')


def _row_to_dict(row):
    return {
        'reparation_id': row.ReparationId,
        'reparation_description': row.ReparationDescription,
        'reparation_begin_date': row.ReparationBeginDate.isoformat() if row.ReparationBeginDate else None,
        'reparation_end_date': row.ReparationEndDate.isoformat() if row.ReparationEndDate else None,
        'reparation_cost': float(row.ReparationCost) if row.ReparationCost is not None else None,
        'bike_id': row.BikeId,
    }


@reparations_bp.get('/')
@reparations_bp.get('')
def get_reparations():
    """Liste les réparations, avec filtre optionnel par bike_id."""
    bike_id = request.args.get('bike_id')
    query = "SELECT ReparationId, ReparationDescription, ReparationBeginDate, ReparationEndDate, ReparationCost, BikeId FROM dbo.Reparation"
    params = []
    if bike_id:
        query += " WHERE BikeId = ?"
        params.append(int(bike_id))
    query += " ORDER BY ReparationBeginDate DESC"

    cursor = get_db().cursor()
    cursor.execute(query, *params)
    return jsonify([_row_to_dict(r) for r in cursor.fetchall()])


@reparations_bp.post('/')
@reparations_bp.post('')
def create_reparation():
    """Ouvre une réparation et marque le vélo comme indisponible."""
    data = request.get_json()
    if not data or not data.get('bike_id') or not data.get('reparation_description'):
        abort(400, description="bike_id et reparation_description sont requis.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT BikeId FROM dbo.Bike WHERE BikeId = ?", data['bike_id'])
    if not cursor.fetchone():
        abort(404, description="Vélo introuvable.")

    cursor.execute("""
        INSERT INTO dbo.Reparation (ReparationDescription, BikeId)
        OUTPUT INSERTED.ReparationId
        VALUES (?, ?)
    """, data['reparation_description'], data['bike_id'])
    new_id = cursor.fetchone()[0]

    cursor.execute("UPDATE dbo.Bike SET IsAvailable = 0 WHERE BikeId = ?", data['bike_id'])
    conn.commit()

    cursor.execute(
        "SELECT ReparationId, ReparationDescription, ReparationBeginDate, ReparationEndDate, ReparationCost, BikeId FROM dbo.Reparation WHERE ReparationId = ?",
        new_id
    )
    return jsonify(_row_to_dict(cursor.fetchone())), 201


@reparations_bp.patch('/<int:reparation_id>/close')
def close_reparation(reparation_id):
    """Clore une réparation et remet le vélo disponible."""
    data = request.get_json()
    if not data or not data.get('reparation_end_date'):
        abort(400, description="reparation_end_date est requis.")

    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT ReparationId, BikeId FROM dbo.Reparation WHERE ReparationId = ?", reparation_id)
    rep = cursor.fetchone()
    if not rep:
        abort(404, description="Réparation introuvable.")

    cursor.execute("""
        UPDATE dbo.Reparation
        SET ReparationEndDate = ?, ReparationCost = ?
        WHERE ReparationId = ?
    """, data['reparation_end_date'], data.get('reparation_cost'), reparation_id)

    cursor.execute("UPDATE dbo.Bike SET IsAvailable = 1 WHERE BikeId = ?", rep.BikeId)
    conn.commit()

    cursor.execute(
        "SELECT ReparationId, ReparationDescription, ReparationBeginDate, ReparationEndDate, ReparationCost, BikeId FROM dbo.Reparation WHERE ReparationId = ?",
        reparation_id
    )
    return jsonify(_row_to_dict(cursor.fetchone()))
