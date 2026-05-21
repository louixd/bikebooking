import { useEffect, useState } from 'react'
import SlotPicker from './SlotPicker.jsx'

const BIKE_RULES_URL = 'https://elcialys.sharepoint.com/sites/Intranet-elcia2/_layouts/15/AccessDenied.aspx?Source=https%3A%2F%2Felcialys.sharepoint.com%2Fsites%2FIntranet-elcia2%2FDocuments+partages%2FForms%2FAllItems.aspx%3Fid%3D%252Fsites%252FIntranet-elcia2%252FDocuments%2Bpartages%252FRessources%2BHumaines%2BElcia%252FInformations%2BRH%252FForfait%2BMobilit%25C3%25A9%2BDurable%2B%2528FMD%2529%252FR%25C3%25A8glement%2Butilisation%2Bdes%2Bv%25C3%25A9los.pdf%26parent%3D%252Fsites%252FIntranet-elcia2%252FDocuments%2Bpartages%252FRessources%2BHumaines%2BElcia%252FInformations%2BRH%252FForfait%2BMobilit%25C3%25A9%2BDurable%2B%2528FMD%2529%26xsdata%3DMDV8MDJ8fDRiNmNhMzY5MDYzMzQxZmUzYTU2MDhkZWI2ODAxYTEyfDYxOWYzZTMwZDAwNzRiYWJhODY1ZmRlNjA4OTBlYTA4fDB8MHw2MzkxNDg4NTg0NDI2NjA0Mzh8VW5rbm93bnxWR1ZoYlhOVFpXTjFjbWwwZVZObGNuWnBZMlY4ZXlKRFFTSTZJbFJsWVcxelgwRlVVRk5sY25acFkyVmZVMUJQVEU5R0lpd2lWaUk2SWpBdU1DNHdNREF3SWl3aVVDSTZJbGRwYmpNeUlpd2lRVTRpT2lKUGRHaGxjaUlzSWxkVUlqb3hNWDA9fDF8TDJOb1lYUnpMekU1T21FNFpUZ3hNakkxTFdNd1pHUXRORFExTkMwNU1UY3hMV1l3WVRJelpHVTRPRGxqT1Y5a1ltVmpOMll4WXkxbE9EZ3hMVFJsWW1VdFltTTFPQzAwWkdJMk5UWmpNemRsTWpGQWRXNXhMbWRpYkM1emNHRmpaWE12YldWemMyRm5aWE12TVRjM09USTRPVEEwTWpNME1RPT18YjQ5NTk2YWYzYWU4NGE2MzFjNDYwOGRlYjY4MDFhMTF8MWFlNDc2NmEwMzU2NDk0Y2E2M2E1MzMzNjU0OTBlOTQ%253D%26sdata%3Db3krKy9lN3F2d1ZYM2d1V3BxRXN6d0xaSDZMbCtXS2kwMVJmVkp0MGwvMD0%253D%26ovuser%3D619f3e30-d007-4bab-a865-fde60890ea08%252Clcuzin%2540elcia.com%26CID%3Da98ce136-126b-42e2-b599-b1bb00e96717%26OR%3DTeams-HL%26CT%3D1779357191020%26clickparams%3DeyJBcHBOYW1lIjoiVGVhbXMtRGVza3RvcCIsIkFwcFZlcnNpb24iOiI0OS8yNjA0MTYxNzIxNSIsIkhhc0ZlZGVyYXRlZFVzZXIiOmZhbHNlfQ%253D%253D&correlation=0dc215a2-0004-1001-5e28-b6370f1dddd1&Type=item&name=371f8a1d-d9a7-49e3-a6c5-d8fb3b370660&listItemId=130&listItemUniqueId=44e5a93b-24c6-4673-a419-8f9cb456841c&allowautoredirecttosource=true'

export default function ReservationForm({ bike, bikeStatus = bike, slot, onSlotChange, onSubmit, onCancel, currentUser = null }) {
  const [guestName, setGuestName] = useState('')
  const [rulesAccepted, setRulesAccepted] = useState(false)
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
    if (!rulesAccepted) { setError('Tu dois lire et accepter le règlement avant de réserver.'); return }
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
          <label className={`rules-consent ${rulesAccepted ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={rulesAccepted}
              onChange={(event) => setRulesAccepted(event.target.checked)}
            />
            <span>
              J'ai lu et j'accepte le{' '}
              <a href={BIKE_RULES_URL} target="_blank" rel="noreferrer">
                règlement d'utilisation des vélos
              </a>
              .
            </span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onCancel}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading || bikeUnavailableOnSlot || !rulesAccepted}>
              {loading ? 'Réservation...' : 'Réserver maintenant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
