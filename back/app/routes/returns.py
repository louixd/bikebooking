from flask import Blueprint, jsonify, request, abort
from ..db import get_db
from ..email import send_email, get_maintenance_email

returns_bp = Blueprint('returns', __name__, url_prefix='/returns')

MAX_PHOTOS = 5
MAX_PHOTO_BYTES = 5 * 1024 * 1024  # 5 MB par photo
ALLOWED_MIMETYPES = {'image/jpeg', 'image/png', 'image/webp', 'image/gif'}


def _row_to_dict(row):
    return {
        'return_id': row.ReturnId,
        'reservation_id': row.ReservationId,
        'return_date': row.ReturnDate.isoformat() if row.ReturnDate else None,
        'problem_state': row.ProblemState,
        'return_state': row.ReturnState,
        'return_comment': row.ReturnComment,
        'mileage_km': float(row.MileageKm) if hasattr(row, 'MileageKm') and row.MileageKm is not None else None,
        'bike_id': row.BikeId,
        'reservation_code': row.ReservationCode if hasattr(row, 'ReservationCode') else None,
        'bike_name': row.BikeName if hasattr(row, 'BikeName') else None,
    }


@returns_bp.get('/')
@returns_bp.get('')
def get_returns():
    """Retourne l'historique des retours, du plus récent au plus ancien."""
    cursor = get_db().cursor()
    cursor.execute("""
        SELECT ret.ReturnId, ret.ReservationId, ret.ReturnDate, ret.ProblemState, ret.ReturnState, ret.ReturnComment, ret.MileageKm,
               ret.BikeId, res.ReservationCode, bike.BikeName
        FROM dbo.[Return] ret
        LEFT JOIN dbo.Reservation res ON res.ReservationId = ret.ReservationId
        LEFT JOIN dbo.Bike bike ON bike.BikeId = ret.BikeId
        ORDER BY ret.ReturnDate DESC, ret.ReturnId DESC
    """)
    return jsonify([_row_to_dict(r) for r in cursor.fetchall()])


@returns_bp.get('/<int:reservation_id>')
def get_return(reservation_id):
    """Retourne le retour associé à une réservation ou 404."""
    cursor = get_db().cursor()
    cursor.execute(
        "SELECT ReturnId, ReservationId, ReturnDate, ProblemState, ReturnState, ReturnComment, MileageKm, BikeId FROM dbo.[Return] WHERE ReservationId = ?",
        reservation_id
    )
    row = cursor.fetchone()
    if not row:
        abort(404, description="Retour introuvable pour cette réservation.")
    return jsonify(_row_to_dict(row))


def _parse_payload():
    """Parse JSON ou multipart/form-data. Retourne (data_dict, photos_list)."""
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        data = {k: request.form.get(k) for k in request.form.keys()}
        photos = []
        for f in request.files.getlist('photos'):
            if not f or not f.filename:
                continue
            if f.mimetype not in ALLOWED_MIMETYPES:
                abort(400, description=f"Type de fichier non autorisé : {f.mimetype}")
            content = f.read()
            if len(content) > MAX_PHOTO_BYTES:
                abort(400, description=f"Photo trop volumineuse : {f.filename}")
            photos.append((f.filename, content, f.mimetype))
            if len(photos) > MAX_PHOTOS:
                abort(400, description=f"Maximum {MAX_PHOTOS} photos.")
        return data, photos
    data = request.get_json(silent=True) or {}
    return data, []


@returns_bp.post('/')
@returns_bp.post('')
def create_return():
    """Enregistre un retour de vélo et notifie l'équipe de maintenance.

    Accepte JSON ou multipart/form-data (avec photos).
    """
    data, photos = _parse_payload()
    if not data.get('reservation_id') or not data.get('bike_id'):
        abort(400, description="reservation_id et bike_id sont requis.")

    try:
        reservation_id = int(data['reservation_id'])
        bike_id = int(data['bike_id'])
    except (TypeError, ValueError):
        abort(400, description="reservation_id et bike_id doivent être des entiers.")

    problem_state = (data.get('problem_state') or '').strip() or None
    return_state = (data.get('return_state') or '').strip() or None
    mileage_km = None
    if data.get('mileage') not in (None, ''):
        try:
            mileage_km = round(float(str(data.get('mileage')).replace(',', '.')), 1)
        except (TypeError, ValueError):
            abort(400, description="Le kilométrage doit être un nombre.")
        if mileage_km < 0:
            abort(400, description="Le kilométrage ne peut pas être négatif.")
    comment_parts = []
    if mileage_km is not None:
        comment_parts.append(f"Kilométrage : {mileage_km:g} km")
    if data.get('return_comment'):
        comment_parts.append(str(data['return_comment']).strip())
    return_comment = "\n".join(comment_parts) or None
    if return_comment and len(return_comment) > 500:
        return_comment = return_comment[:497] + '...'

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dbo.[Return] (ReservationId, ProblemState, ReturnState, ReturnComment, MileageKm, BikeId)
        OUTPUT INSERTED.ReturnId
        VALUES (?, ?, ?, ?, ?, ?)
    """, reservation_id, problem_state, return_state, return_comment, mileage_km, bike_id)
    new_id = cursor.fetchone()[0]
    conn.commit()

    cursor.execute(
        "SELECT ReturnId, ReservationId, ReturnDate, ProblemState, ReturnState, ReturnComment, MileageKm, BikeId FROM dbo.[Return] WHERE ReturnId = ?",
        new_id
    )
    result = _row_to_dict(cursor.fetchone())

    # Email maintenance envoyé au mieux.
    try:
        cursor.execute("SELECT BikeName, BikeCode FROM dbo.Bike WHERE BikeId = ?", bike_id)
        b = cursor.fetchone()
        bike_label = f"{b.BikeName} ({b.BikeCode})" if b else f"Vélo n° {bike_id}"

        cursor.execute("""
            SELECT r.ReservationCode, r.UserNameFree, u.UserName, u.UserEmail
            FROM dbo.Reservation r
            LEFT JOIN dbo.[User] u ON u.UserId = r.UserId
            WHERE r.ReservationId = ?
        """, reservation_id)
        r = cursor.fetchone()
        if r:
            user_label = r.UserNameFree or (f"{r.UserName} <{r.UserEmail}>" if r.UserName else "Utilisateur inconnu")
            code = r.ReservationCode
        else:
            user_label, code = "Utilisateur inconnu", str(reservation_id)

        body = (
            "Un retour d'état vient d'être signalé sur un vélo.\n\n"
            f"Vélo          : {bike_label}\n"
            f"Réservation   : {code}\n"
            f"Utilisateur   : {user_label}\n"
            f"État          : {return_state or '-'}\n"
            f"Problèmes     : {problem_state or 'aucun'}\n"
            f"Détails       :\n{return_comment or '(aucun)'}\n\n"
            f"Photos jointes : {len(photos)}\n\n"
            "— BikeFlow"
        )
        send_email(
            get_maintenance_email(),
            f"[BikeFlow] Retour d'état - {bike_label}",
            body,
            attachments=photos,
        )
    except Exception:
        pass

    return jsonify(result), 201
