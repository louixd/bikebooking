import { useEffect, useState } from 'react'
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

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

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
      await Promise.resolve(onSuccess?.())
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal return-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header-row return-modal-header">
          <div>
            <p className="return-kicker">Contrôle retour</p>
            <h2>Retour d'état</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fermer le retour">×</button>
        </div>
        <div className="return-summary">
          <strong>{bike?.bike_name || `Velo #${reservation.bike_id}`}</strong>
          <span>Réservation {reservation.reservation_code}</span>
        </div>
        <form onSubmit={handleSubmit}>
          <label>Problèmes constatés</label>
          <div className="return-problem-grid">
            {PROBLEMS.map((p) => (
              <label key={p.value} className={problems.includes(p.value) ? 'return-problem active' : 'return-problem'}>
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
            <p className="return-file-count">
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
