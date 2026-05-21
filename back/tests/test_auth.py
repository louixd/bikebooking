from unittest.mock import MagicMock, patch


class CountRow:
    def __init__(self, value):
        self.value = value

    def __getitem__(self, index):
        return self.value


def test_my_stats_excludes_cancelled_reservations_without_return(client):
    favorite_row = MagicMock()
    favorite_row.BikeName = 'Vélo test'

    with patch('app.routes.auth.get_entra_user_from_request') as mock_get_user, \
         patch('app.routes.auth.get_db') as mock_get_db:
        mock_get_user.return_value = {'user_id': 1, 'is_admin': False}
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            CountRow(1),
            CountRow(1),
            CountRow(0),
            favorite_row,
        ]
        mock_cursor.fetchall.return_value = []
        mock_get_db.return_value.cursor.return_value = mock_cursor

        response = client.get('/auth/me/stats')

    assert response.status_code == 200
    payload = response.get_json()
    assert payload['total_reservations'] == 1
    assert payload['unique_bikes'] == 1
    assert payload['active_reservations'] == 0
    assert payload['favorite_bike'] == 'Vélo test'

    total_query = mock_cursor.execute.call_args_list[0].args[0]
    unique_query = mock_cursor.execute.call_args_list[1].args[0]
    favorite_query = mock_cursor.execute.call_args_list[4].args[0]
    assert 'IsValidate = 1' in total_query
    assert 'EXISTS' in total_query
    assert 'dbo.[Return]' in total_query
    assert 'IsValidate = 1' in unique_query
    assert 'EXISTS' in unique_query
    assert 'res.IsValidate = 1' in favorite_query
    assert 'EXISTS' in favorite_query