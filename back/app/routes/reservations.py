import uuid
from datetime import datetime
from flask import Blueprint, jsonify, request, abort
from ..db import get_db
from ..email import send_email, get_reservation_notify_email

reservations_bp = Blueprint('reservations', __name__, url_prefix='/reservations')


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
        SELECT ReservationId, ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId
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
        "SELECT ReservationId, ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId FROM dbo.Reservation WHERE ReservationId = ?",
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
    if not user_id and not user_name_free:
        abort(400, description="Fournis soit un user_id (utilisateur DB) soit un user_name_free (saisie libre).")

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
        INSERT INTO dbo.Reservation (ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId)
        OUTPUT INSERTED.ReservationId
        VALUES (?, ?, ?, 1, ?, ?, ?)
    """, code, data['reservation_date'], data['return_date'], user_id, user_name_free, data['bike_id'])
    new_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute(
        "SELECT ReservationId, ReservationCode, ReservationDate, ReturnDate, IsValidate, UserId, UserNameFree, BikeId FROM dbo.Reservation WHERE ReservationId = ?",
        new_id
    )
    reservation_row = cursor.fetchone()
    reservation_dict = _row_to_dict(reservation_row)

    # Notification email à l'équipe (db@elcia.com par défaut)
    try:
        cursor.execute("SELECT BikeName, BikeCode FROM dbo.Bike WHERE BikeId = ?", data['bike_id'])
        bike_row = cursor.fetchone()
        bike_label = f"{bike_row.BikeName} ({bike_row.BikeCode})" if bike_row else f"Bike #{data['bike_id']}"

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
            f"Date début     : {start_dt.strftime('%d/%m/%Y') if start_dt else '-'}\n"
            f"Heure début    : {start_dt.strftime('%H:%M') if start_dt else '-'}\n"
            f"Date fin       : {end_dt.strftime('%d/%m/%Y') if end_dt else '-'}\n"
            f"Heure fin      : {end_dt.strftime('%H:%M') if end_dt else '-'}\n\n"
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
    cursor.execute("SELECT ReservationId FROM dbo.Reservation WHERE ReservationId = ?", reservation_id)
    if not cursor.fetchone():
        abort(404, description="Réservation introuvable.")
    cursor.execute("UPDATE dbo.Reservation SET IsValidate = 0 WHERE ReservationId = ?", reservation_id)
    conn.commit()
    return jsonify({'message': 'Réservation annulée.', 'reservation_id': reservation_id})
