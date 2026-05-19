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
    row.BikeId = 1
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
    with patch('app.routes.reservations.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = MagicMock()  # réservation existe
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.patch('/reservations/1/cancel')
        assert resp.status_code == 200
