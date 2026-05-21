import re

from flask import Blueprint, current_app, jsonify, request, abort
from ..db import get_db
from ..entra import get_entra_user_from_request, validate_entra_token, upsert_entra_user

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


@auth_bp.post('/login')
def login():
    abort(410, description='La connexion locale est remplacée par Microsoft Entra ID.')


@auth_bp.post('/register')
def register():
    abort(410, description='La création de comptes locaux est remplacée par Microsoft Entra ID.')


@auth_bp.get('/config')
def auth_config():
    tenant_id = current_app.config.get('ENTRA_TENANT_ID')
    client_id = current_app.config.get('ENTRA_CLIENT_ID')
    return jsonify({
        'provider': 'entra_id',
        'enabled': bool(tenant_id and client_id),
        'tenant_id': tenant_id,
        'client_id': client_id,
        'authority': f'https://login.microsoftonline.com/{tenant_id}' if tenant_id else None,
        'scopes': ['openid', 'profile', 'email'],
    })


@auth_bp.post('/entra')
def login_entra():
    data = request.get_json(silent=True) or {}
    token = str(data.get('id_token') or '').strip()
    user = upsert_entra_user(validate_entra_token(token))
    return jsonify(user)


@auth_bp.get('/me/stats')
def my_stats():
    user = get_entra_user_from_request(required=True)
    cursor = get_db().cursor()

    counted_reservation_filter = """
        UserId = ?
        AND (
            IsValidate = 1
            OR EXISTS (
                SELECT 1
                FROM dbo.[Return] ret
                WHERE ret.ReservationId = dbo.Reservation.ReservationId
            )
        )
    """

    cursor.execute(f"SELECT COUNT(*) FROM dbo.Reservation WHERE {counted_reservation_filter}", user['user_id'])
    total_reservations = int(cursor.fetchone()[0] or 0)

    cursor.execute(f"SELECT COUNT(DISTINCT BikeId) FROM dbo.Reservation WHERE {counted_reservation_filter}", user['user_id'])
    unique_bikes = int(cursor.fetchone()[0] or 0)

    cursor.execute("SELECT COUNT(*) FROM dbo.Reservation WHERE UserId = ? AND IsValidate = 1", user['user_id'])
    active_reservations = int(cursor.fetchone()[0] or 0)

    cursor.execute(
        """
        SELECT ret.MileageKm, ret.ReturnComment
        FROM dbo.[Return] ret
        INNER JOIN dbo.Reservation res ON res.ReservationId = ret.ReservationId
        WHERE res.UserId = ?
        """,
        user['user_id'],
    )
    return_rows = cursor.fetchall()
    total_km = 0.0
    for row in return_rows:
        if hasattr(row, 'MileageKm') and row.MileageKm is not None:
            total_km += float(row.MileageKm)
            continue
        match = re.search(r'Kilom[eé]trage\s*:\s*(\d+(?:[,.]\d+)?)', row.ReturnComment or '', flags=re.IGNORECASE)
        if match:
            total_km += float(match.group(1).replace(',', '.'))

    cursor.execute(
        """
        SELECT bike.BikeName, COUNT(*) AS RentalCount
        FROM dbo.Reservation res
        LEFT JOIN dbo.Bike bike ON bike.BikeId = res.BikeId
                WHERE res.UserId = ?
                    AND (
                            res.IsValidate = 1
                            OR EXISTS (
                                    SELECT 1
                                    FROM dbo.[Return] ret
                                    WHERE ret.ReservationId = res.ReservationId
                            )
                    )
        GROUP BY bike.BikeName
        ORDER BY RentalCount DESC, bike.BikeName ASC
        LIMIT 1
        """,
        user['user_id'],
    )
    favorite = cursor.fetchone()

    return jsonify({
        'total_reservations': total_reservations,
        'active_reservations': active_reservations,
        'returned_reservations': len(return_rows),
        'unique_bikes': unique_bikes,
        'total_km': round(total_km, 1),
        'favorite_bike': favorite.BikeName if favorite and favorite.BikeName else None,
    })
