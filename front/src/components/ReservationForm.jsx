import { useState } from 'react'
import SlotPicker from './SlotPicker.jsx'

export default function ReservationForm({ bike, slot, onSlotChange, onSubmit, onCancel, currentUser = null }) {
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!slot.reservation_date || !slot.return_date) { setError('Selectionne un creneau valide.'); return }
    if (!currentUser?.user_id) { setError('Connecte-toi avec un compte local pour reserver.'); return }
    setError(null)
    setLoading(true)
    try {
      await onSubmit({
        bike_id: bike.bike_id,
        user_id: currentUser.user_id,
        user_name_free: null,
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
      <div className="modal" style={{ maxWidth: 620 }}>
        <h2>Réserver {bike.bike_name}</h2>
        <p className="modal-info">Choisis d'abord un creneau, puis confirme l'utilisateur.</p>
        <form onSubmit={handleSubmit}>
          <SlotPicker value={slot} onChange={onSlotChange} />

          {slot.reservation_date && slot.return_date && (
            <p className="modal-info" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
              Du <strong>{slot.start_date} a {slot.start_time}</strong>
              {' '}au <strong>{slot.end_date} a {slot.end_time}</strong>
            </p>
          )}
          <label>Compte connecté</label>
          <input value={currentUser ? `${currentUser.user_name} (${currentUser.user_email})` : 'Aucun compte connecté'} readOnly />
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'En cours...' : 'Confirmer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
