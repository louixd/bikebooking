from unittest.mock import MagicMock, patch
import json


def make_bike_row(available=True):
    row = MagicMock()
    row.IsAvailable = available
    return row


def make_reservation_row():
    from datetime import datetime
    row = MagicMock()
    row.ReservationId = 1
    row.ReservationCode = 'RES-ABCD1234'
    row.ReservationDate = datetime(2026, 5, 19, 12, 0)
    row.ReturnDate = datetime(2026, 5, 19, 14, 0)
    row.IsValidate = True
    row.UserId = 1
    row.UserNameFree = None
    row.BikeId = 1
    row.GuestOwnerToken = None
    return row


def make_cancel_row(user_id=1, guest_owner_token=None):
    row = MagicMock()
    row.ReservationId = 1
    row.UserId = user_id
    row.GuestOwnerToken = guest_owner_token
    return row


def test_create_reservation_success(client):
    with patch('app.routes.reservations.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        # IsAvailable = True, pas de conflit, INSERT OK
        mock_cursor.fetchone.side_effect = [
            make_bike_row(True),   # vérif IsAvailable
            MagicMock(__getitem__=lambda s, i: 0),  # COUNT conflit = 0
            MagicMock(__getitem__=lambda s, i: 1),  # INSERTED.ReservationId = 1
            make_reservation_row(),  # SELECT final
        ]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.post('/reservations', json={
            'bike_id': 1,
            'user_id': 1,
            'reservation_date': '2026-05-19T12:00:00',
            'return_date': '2026-05-19T14:00:00',
        })
        assert resp.status_code == 201


def test_create_reservation_bike_unavailable(client):
    with patch('app.routes.reservations.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = make_bike_row(False)
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.post('/reservations', json={
            'bike_id': 1,
            'user_id': 1,
            'reservation_date': '2026-05-19T12:00:00',
            'return_date': '2026-05-19T14:00:00',
        })
        assert resp.status_code == 409


def test_create_reservation_slot_conflict(client):
    with patch('app.routes.reservations.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        count_row = MagicMock()
        count_row.__getitem__ = lambda s, i: 1
        mock_cursor.fetchone.side_effect = [
            make_bike_row(True),  # IsAvailable OK
            count_row,            # conflit = 1
        ]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.post('/reservations', json={
            'bike_id': 1,
            'user_id': 1,
            'reservation_date': '2026-05-19T12:00:00',
            'return_date': '2026-05-19T14:00:00',
        })
        assert resp.status_code == 409


def test_cancel_reservation(client):
    with patch('app.routes.reservations.get_db') as mock_get_db, \
         patch('app.routes.reservations.get_entra_user_from_request') as mock_get_entra_user:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = make_cancel_row()  # réservation compte utilisateur
        mock_get_db.return_value.cursor.return_value = mock_cursor
        mock_get_entra_user.return_value = {'user_id': 1, 'is_admin': False}

        resp = client.patch('/reservations/1/cancel')
        assert resp.status_code == 200


def test_cancel_user_reservation_rejects_other_user(client):
    with patch('app.routes.reservations.get_db') as mock_get_db, \
         patch('app.routes.reservations.get_entra_user_from_request') as mock_get_entra_user:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = make_cancel_row(user_id=1)
        mock_get_db.return_value.cursor.return_value = mock_cursor
        mock_get_entra_user.return_value = {'user_id': 2, 'is_admin': False}

        resp = client.patch('/reservations/1/cancel')
        assert resp.status_code == 403


def test_cancel_user_reservation_allows_admin(client):
    with patch('app.routes.reservations.get_db') as mock_get_db, \
         patch('app.routes.reservations.get_entra_user_from_request') as mock_get_entra_user:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = make_cancel_row(user_id=1)
        mock_get_db.return_value.cursor.return_value = mock_cursor
        mock_get_entra_user.return_value = {'user_id': 2, 'is_admin': True}

        resp = client.patch('/reservations/1/cancel')
        assert resp.status_code == 200


def test_cancel_guest_reservation_with_owner_cookie(client):
    with patch('app.routes.reservations.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = make_cancel_row(user_id=None, guest_owner_token='owner-123')
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.patch('/reservations/1/cancel', headers={'X-Bikeflow-Guest-Token': 'owner-123'})
        assert resp.status_code == 200


def test_cancel_guest_reservation_rejects_wrong_cookie(client):
    with patch('app.routes.reservations.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = make_cancel_row(user_id=None, guest_owner_token='owner-123')
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.patch('/reservations/1/cancel', headers={'X-Bikeflow-Guest-Token': 'other-browser'})
        assert resp.status_code == 403
