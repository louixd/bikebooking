import { useState } from 'react'
import { createReturnWithPhotos } from '../api/bikeflowApi.js'

const PROBLEMS = [
  { value: 'tire_flat', label: 'Pneu dégonflé' },
  { value: 'scratches', label: 'Rayures' },
  { value: 'mechanical', label: 'Problème mécanique' },
  { value: 'other', label: 'Autre' },
]

export default function ReturnForm({ reservation, bike, onClose, onSuccess }) {
  const [problems, setProblems] = useState([])
  const [mileage, setMileage] = useState('')
  const [comment, setComment] = useState('')
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  function toggleProblem(v) {
    setProblems((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]))
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []).slice(0, 5)
    setPhotos(files)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await createReturnWithPhotos({
        reservation_id: reservation.reservation_id,
        bike_id: reservation.bike_id,
        problem_state: problems.join(',') || null,
        return_state: problems.length ? 'ko' : 'ok',
        return_comment: comment,
        mileage,
        photos,
      })
      setSuccess(true)
      onSuccess?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="modal-overlay">
        <div className="modal">
          <h2>Merci !</h2>
          <p className="modal-info">
            Votre retour d'état a bien été transmis à l'équipe de maintenance.
          </p>
          <div className="modal-actions">
            <button className="btn-primary" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 520 }}>
        <h2>Retour d'état</h2>
        <p className="modal-info">
          <strong>{bike?.bike_name || `Velo #${reservation.bike_id}`}</strong>
          {' '}— Réservation <code>{reservation.reservation_code}</code>
        </p>
        <form onSubmit={handleSubmit}>
          <label>Problèmes constatés</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginBottom: '0.5rem' }}>
            {PROBLEMS.map((p) => (
              <label key={p.value} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 400, margin: 0 }}>
                <input
                  type="checkbox"
                  checked={problems.includes(p.value)}
                  onChange={() => toggleProblem(p.value)}
                />
                {p.label}
              </label>
            ))}
          </div>

          <label htmlFor="ret-mileage">Kilométrage approximatif</label>
          <input
            id="ret-mileage"
            type="number"
            min="0"
            placeholder="ex: 1250"
            value={mileage}
            onChange={(e) => setMileage(e.target.value)}
          />

          <label htmlFor="ret-comment">Description</label>
          <textarea
            id="ret-comment"
            rows={3}
            placeholder="Détaillez le problème ou laissez vide si tout va bien"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ccc', borderRadius: 6, fontFamily: 'inherit', fontSize: '0.95rem' }}
          />

          <label htmlFor="ret-photos">Photos (optionnel, max 5)</label>
          <input
            id="ret-photos"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
          />
          {photos.length > 0 && (
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
              {photos.length} photo(s) sélectionnée(s)
            </p>
          )}

          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Envoi…' : 'Envoyer le retour'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
