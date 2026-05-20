import { useEffect, useState } from 'react'
import SlotPicker from './SlotPicker.jsx'

export default function ReservationForm({ bike, bikeStatus = bike, slot, onSlotChange, onSubmit, onCancel, currentUser = null }) {
  const [guestName, setGuestName] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const bikeUnavailableOnSlot = !!slot.reservation_date && !!slot.return_date && !!bikeStatus?.reserve_disabled

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!slot.reservation_date || !slot.return_date) { setError('Sélectionne un créneau valide.'); return }
    if (bikeUnavailableOnSlot) { setError(bikeStatus?.availability_label || 'Ce vélo est réservé sur ce créneau.'); return }
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
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-compact modal-reservation" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header-row">
          <h2>Réserver {bike.bike_name}</h2>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="Fermer la réservation">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={`reservation-status-banner ${bikeUnavailableOnSlot ? 'danger' : 'ok'}`}>
            <strong>{bikeUnavailableOnSlot ? 'Indisponible' : 'Disponible'}</strong>
            <span>{bikeStatus?.availability_label || 'Créneau libre'}</span>
          </div>

          <SlotPicker value={slot} onChange={onSlotChange} />

          {bikeUnavailableOnSlot && (
            <p className="form-error">{bikeStatus?.availability_label || 'Ce vélo est réservé sur ce créneau.'}</p>
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
