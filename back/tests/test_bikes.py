from unittest.mock import MagicMock, patch


def make_bike_row(bike_id=1, name='Vélo 1', size='M', code='VELO-1', desc='Test', available=True):
    row = MagicMock()
    row.BikeId = bike_id
    row.BikeName = name
    row.BikeSize = size
    row.BikeCode = code
    row.BikeDescription = desc
    row.IsAvailable = available
    return row


def test_get_bikes_returns_list(client):
    bikes = [make_bike_row(i, f'Vélo {i}', 'M', f'VELO-{i}', 'Desc', True) for i in range(1, 5)]
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchall.return_value = bikes
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.get('/bikes')
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data) == 4
        assert data[0]['bike_code'] == 'VELO-1'


def test_get_bike_not_found(client):
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = None
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.get('/bikes/999')
        assert resp.status_code == 404
