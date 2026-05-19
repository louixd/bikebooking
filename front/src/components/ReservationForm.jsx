import { useState } from 'react'
import SlotPicker from './SlotPicker.jsx'

export default function ReservationForm({ bike, bikeStatus = bike, slot, onSlotChange, onSubmit, onCancel, currentUser = null }) {
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const bikeUnavailableOnSlot = !!slot.reservation_date && !!slot.return_date && !!bikeStatus?.reserve_disabled

  async function handleSubmit(e) {
    e.preventDefault()
    if (!slot.reservation_date || !slot.return_date) { setError('Sélectionne un créneau valide.'); return }
    if (bikeUnavailableOnSlot) { setError(bikeStatus?.availability_label || 'Ce vélo est déjà réservé sur ce créneau.'); return }
    if (!currentUser?.user_id && !guestName.trim()) { setError('Renseigne ton nom et prénom pour réserver.'); return }
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        bike_id: bike.bike_id,
        user_id: currentUser?.user_id || null,
        user_name_free: currentUser ? null : guestName.trim(),
        reservation_date: slot.reservation_date,
        return_date: slot.return_date,
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal modal-compact modal-reservation" style={{ maxWidth: 620 }}>
        <h2>Réserver {bike.bike_name}</h2>
        <p className="modal-info">Un nom, un créneau, puis validation.</p>
        <form onSubmit={handleSubmit}>
          <div className={`reservation-status-banner ${bikeUnavailableOnSlot ? 'danger' : 'ok'}`}>
            <strong>{bikeUnavailableOnSlot ? 'Vélo indisponible sur ce créneau' : 'Vélo réservable sur ce créneau'}</strong>
            <span>{bikeStatus?.availability_label || 'Disponible'}</span>
          </div>

          <SlotPicker value={slot} onChange={onSlotChange} />

          {slot.reservation_date && slot.return_date && (
            <p className="modal-info" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
              Du <strong>{slot.start_date} à {slot.start_time}</strong>
              {' '}au <strong>{slot.end_date} à {slot.end_time}</strong>
            </p>
          )}
          {bikeUnavailableOnSlot && (
            <p className="form-error">{bikeStatus?.availability_label || 'Ce vélo est déjà réservé sur ce créneau.'}</p>
          )}
          {currentUser ? (
            <>
              <label>Réservation au nom de</label>
              <input value={`${currentUser.user_name} (${currentUser.user_email})`} readOnly />
            </>
          ) : (
            <>
              <label>Nom employé</label>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nom prénom"
              />
              <div className="reservation-safety-box">
                <strong>Sécurité</strong>
                <p>Casque, freins et éclairage vérifiés avant départ.</p>
              </div>
              <p className="modal-info" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                Aucun compte n'est requis. Depuis ce navigateur, tu pourras aussi annuler et faire le retour toi-même.
              </p>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading || bikeUnavailableOnSlot}>
              {loading ? 'Réservation...' : 'Réserver maintenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
