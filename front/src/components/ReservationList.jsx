export default function ReservationList({ reservations, bikes, users, currentUser, guestReservationIds = [], onCancel, onReturn, showCancel = true }) {
  function getBikeName(id) {
    return bikes.find((b) => b.bike_id === id)?.bike_name || `Vélo ${id}`
  }
  function getUserName(r) {
    if (r.user_name_free) return r.user_name_free
    return users.find((u) => u.user_id === r.user_id)?.user_name || `User ${r.user_id}`
  }

  function canManageReservation(reservation) {
    if (!currentUser) return guestReservationIds.includes(reservation.reservation_id)
    if (currentUser.is_admin) return true
    return reservation.user_id === currentUser.user_id
  }

  if (!reservations.length) {
    return <p className="empty-list">Aucune réservation pour ce créneau.</p>
  }

  return (
    <table className="reservation-table">
      <thead>
        <tr>
          <th>Code</th>
          <th>Vélo</th>
          <th>Utilisateur</th>
          <th>Début</th>
          <th>Fin</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {reservations.map((r) => (
          <tr key={r.reservation_id}>
            <td><code>{r.reservation_code}</code></td>
            <td>{getBikeName(r.bike_id)}</td>
            <td>{getUserName(r)}</td>
            <td>{r.reservation_date?.slice(11, 16)}</td>
            <td>{r.return_date?.slice(11, 16)}</td>
            <td style={{ display: 'flex', gap: '0.4rem' }}>
              {onReturn && canManageReservation(r) && (
                <button className="btn-return" onClick={() => onReturn(r)}>
                  Retour
                </button>
              )}
              {showCancel && canManageReservation(r) ? (
                <button className="btn-cancel" onClick={() => onCancel(r.reservation_id)}>
                  Annuler
                </button>
              ) : !showCancel && onReturn && canManageReservation(r) ? null : (
                <span className="reservation-muted">Lecture seule</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
