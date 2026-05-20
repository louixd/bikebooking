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


def test_create_bike_with_quantity_creates_unique_codes(client):
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchall.side_effect = [[], [
            make_bike_row(1, 'Vélo test 01', 'M', 'VL-TEST-01', 'cadre en trapeze', True),
            make_bike_row(2, 'Vélo test 02', 'M', 'VL-TEST-02', 'cadre en trapeze', True),
            make_bike_row(3, 'Vélo test 03', 'M', 'VL-TEST-03', 'cadre en trapeze', True),
        ]]
        mock_cursor.fetchone.side_effect = [(1,), (2,), (3,)]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.post('/bikes', json={
            'bike_name': 'Vélo test',
            'bike_code': 'VL-TEST',
            'bike_size': 'M',
            'bike_description': 'cadre en trapeze',
            'bike_quantity': 3,
        })

        assert resp.status_code == 201
        data = resp.get_json()
        assert data['quantity'] == 3
        assert [item['bike_code'] for item in data['created']] == ['VL-TEST-01', 'VL-TEST-02', 'VL-TEST-03']


def test_create_bike_rejects_invalid_quantity(client):
    resp = client.post('/bikes', json={
        'bike_name': 'Vélo test',
        'bike_code': 'VL-TEST',
        'bike_size': 'M',
        'bike_quantity': 0,
    })

    assert resp.status_code == 400


def test_update_bike_success(client):
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            MagicMock(BikeId=1),
            None,
            make_bike_row(1, 'Vélo modifié', 'L', 'VL-MOD', 'cadre en col de cygne', False),
        ]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.patch('/bikes/1', json={
            'bike_name': 'Vélo modifié',
            'bike_code': 'VL-MOD',
            'bike_size': 'L',
            'bike_description': 'cadre en col de cygne',
            'is_available': False,
        })

        assert resp.status_code == 200
        data = resp.get_json()
        assert data['bike_name'] == 'Vélo modifié'
        assert data['bike_code'] == 'VL-MOD'
        assert data['is_available'] is False


def test_update_bike_rejects_duplicate_code(client):
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [MagicMock(BikeId=1), MagicMock(BikeId=2)]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.patch('/bikes/1', json={'bike_code': 'VL-EXISTANT'})

        assert resp.status_code == 409


def test_delete_bike_success(client):
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            MagicMock(BikeId=1),
            (0,),
            (0,),
            (0,),
        ]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.delete('/bikes/1')

        assert resp.status_code == 200
        assert resp.get_json()['bike_id'] == 1
        assert any(call.args[0] == "DELETE FROM dbo.Bike WHERE BikeId = ?" for call in mock_cursor.execute.call_args_list)
        mock_get_db.return_value.commit.assert_called_once()


def test_delete_bike_rejects_active_reservation(client):
    with patch('app.routes.bikes.get_db') as mock_get_db:
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [MagicMock(BikeId=1), (1,)]
        mock_get_db.return_value.cursor.return_value = mock_cursor

        resp = client.delete('/bikes/1')

        assert resp.status_code == 409
        mock_get_db.return_value.commit.assert_not_called()
