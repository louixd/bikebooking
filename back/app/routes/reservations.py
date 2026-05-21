import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request, abort
from ..db import get_db
from ..email import send_email, get_reservation_notify_email
from ..entra import get_entra_user_from_request

reservations_bp = Blueprint('reservations', __name__, url_prefix='/reservations')


def _get_guest_owner_token():
    return (request.headers.get('X-Bikeflow-Guest-Token') or '').strip()[:80] or None


def _row_to_dict(row):
    return {
        'reservation_id': row.ReservationId,
        'reservation_code': row.ReservationCode,
        'reservation_date': row.ReservationDate.isoformat() if row.ReservationDate else None,
        'return_date': row.ReturnDate.isoformat() if row.ReturnDate else None,
        'is_validate': bool(row.IsValidate),
        'user_id': row.UserId,
        'user_name_free': row.UserNameFree if hasattr(row, 'UserNameFree') else None,
        'bike_id': row.BikeId,
    }


@reservations_bp.get('/')
@reservations_bp.get('')
def get_reservations():
    """Liste les réservations actives avec filtres optionnels : date, bike_id, user_id."""
    date_filter = request.args.get('date')
    bike_id = request.args.get('bike_id')
    user_id = request.args.get('user_id')

    query = """
        SELECT ReservationId, ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId, GuestOwnerToken
        FROM dbo.Reservation
        WHERE IsValidate = 1
    """
    params = []
    if date_filter:
        query += " AND CAST(ReservationDate AS DATE) = ?"
        params.append(date_filter)
    if bike_id:
        query += " AND BikeId = ?"
        params.append(int(bike_id))
    if user_id:
        query += " AND UserId = ?"
        params.append(int(user_id))
    query += " ORDER BY ReservationDate"

    cursor = get_db().cursor()
    cursor.execute(query, *params)
    return jsonify([_row_to_dict(r) for r in cursor.fetchall()])


@reservations_bp.get('/<int:reservation_id>')
def get_reservation(reservation_id):
    """Retourne le détail d'une réservation ou 404."""
    cursor = get_db().cursor()
    cursor.execute(
        "SELECT ReservationId, ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId, GuestOwnerToken FROM dbo.Reservation WHERE ReservationId = ?",
        reservation_id
    )
    row = cursor.fetchone()
    if not row:
        abort(404, description="Réservation introuvable.")
    return jsonify(_row_to_dict(row))


@reservations_bp.post('/')
@reservations_bp.post('')
def create_reservation():
    """Crée une réservation après vérification de disponibilité."""
    data = request.get_json()
    required = ['bike_id', 'reservation_date', 'return_date']
    if not data or not all(k in data for k in required):
        abort(400, description=f"Champs requis : {required}")
    user_id = data.get('user_id')
    user_name_free = data.get('user_name_free', '').strip() if data.get('user_name_free') else None
    entra_user = get_entra_user_from_request(required=False)
    if entra_user:
        user_id = entra_user['user_id']
        user_name_free = None
    guest_owner_token = None if user_id else _get_guest_owner_token()
    if not user_id and not user_name_free:
        abort(400, description="Fournissez soit un user_id (utilisateur DB), soit un user_name_free (saisie libre).")
    if not user_id and not guest_owner_token:
        abort(400, description="Cookie d'identification invité manquant.")

    conn = get_db()
    cursor = conn.cursor()

    # Vérifier IsAvailable
    cursor.execute("SELECT IsAvailable FROM dbo.Bike WHERE BikeId = ?", data['bike_id'])
    bike = cursor.fetchone()
    if not bike:
        abort(404, description="Vélo introuvable.")
    if not bike.IsAvailable:
        abort(409, description="Ce vélo n'est pas disponible (en réparation).")

    # Vérifier chevauchement de créneau
    cursor.execute("""
        SELECT COUNT(*) FROM dbo.Reservation
        WHERE BikeId = ? AND IsValidate = 1
          AND ReservationDate < ? AND ReturnDate > ?
    """, data['bike_id'], data['return_date'], data['reservation_date'])
    if cursor.fetchone()[0] > 0:
        abort(409, description="Ce vélo est déjà réservé sur ce créneau.")

    # Générer un code unique
    code = f"RES-{str(uuid.uuid4())[:8].upper()}"

    cursor.execute("""
        INSERT INTO dbo.Reservation (ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId, GuestOwnerToken)
        OUTPUT INSERTED.ReservationId
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
    """, code, data['reservation_date'], data['return_date'], user_id, user_name_free, data['bike_id'], guest_owner_token)
    new_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute(
        "SELECT ReservationId, ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId, GuestOwnerToken FROM dbo.Reservation WHERE ReservationId = ?",
        new_id
    )
    reservation_row = cursor.fetchone()
    reservation_dict = _row_to_dict(reservation_row)

    # Notification email à l'équipe (db@elcia.com par défaut)
    try:
        cursor.execute("SELECT BikeName, BikeCode FROM dbo.Bike WHERE BikeId = ?", data['bike_id'])
        bike_row = cursor.fetchone()
        bike_label = f"{bike_row.BikeName} ({bike_row.BikeCode})" if bike_row else f"Vélo n° {data['bike_id']}"

        if user_id:
            cursor.execute("SELECT UserName, UserEmail FROM dbo.[User] WHERE UserId = ?", user_id)
            u = cursor.fetchone()
            user_label = f"{u.UserName} <{u.UserEmail}>" if u else f"User #{user_id}"
        else:
            user_label = user_name_free or "Utilisateur inconnu"

        start_dt = reservation_row.ReservationDate
        end_dt = reservation_row.ReturnDate
        body = (
            "Une nouvelle réservation de vélo vient d'être enregistrée.\n\n"
            f"Code           : {reservation_row.ReservationCode}\n"
            f"Utilisateur    : {user_label}\n"
            f"Modèle de vélo : {bike_label}\n"
            f"Date de début  : {start_dt.strftime('%d/%m/%Y') if start_dt else '-'}\n"
            f"Heure de début : {start_dt.strftime('%H:%M') if start_dt else '-'}\n"
            f"Date de fin    : {end_dt.strftime('%d/%m/%Y') if end_dt else '-'}\n"
            f"Heure de fin   : {end_dt.strftime('%H:%M') if end_dt else '-'}\n\n"
            "— BikeFlow"
        )
        send_email(get_reservation_notify_email(), "Nouvelle réservation de vélo", body)
    except Exception:
        # Ne jamais faire échouer la création de réservation à cause d'un email
        pass

    return jsonify(reservation_dict), 201


@reservations_bp.patch('/<int:reservation_id>/cancel')
def cancel_reservation(reservation_id):
    """Annule une réservation (soft delete : IsValidate = 0)."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT ReservationId, UserId, GuestOwnerToken FROM dbo.Reservation WHERE ReservationId = ?", reservation_id)
    row = cursor.fetchone()
    if not row:
        abort(404, description="Réservation introuvable.")

    entra_user = get_entra_user_from_request(required=False)
    is_admin_override = bool(entra_user and entra_user['is_admin'])
    if row.UserId and not is_admin_override:
        if not entra_user or row.UserId != entra_user['user_id']:
            abort(403, description="Cette réservation appartient à un autre utilisateur.")
    if not row.UserId and row.GuestOwnerToken and not is_admin_override:
        if _get_guest_owner_token() != row.GuestOwnerToken:
            abort(403, description="Cette réservation appartient à un autre navigateur.")

    cursor.execute("UPDATE dbo.Reservation SET IsValidate = 0 WHERE ReservationId = ?", reservation_id)
    conn.commit()
    return jsonify({'message': 'Réservation annulée.', 'reservation_id': reservation_id})
