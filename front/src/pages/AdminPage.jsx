import { useState, useEffect } from 'react'
import { fetchBikes, fetchReparations, createReparation, closeReparation, fetchReservations, createReturn, createBike, fetchReturns } from '../api/bikeflowApi.js'

export default function AdminPage({ mode = 'manage' }) {
  const [bikes, setBikes] = useState([])
  const [reparations, setReparations] = useState([])
  const [reservations, setReservations] = useState([])
  const [returnsHistory, setReturnsHistory] = useState([])
  const [bikeForm, setBikeForm] = useState({ bike_name: '', bike_code: '', bike_size: '', bike_description: '' })
  const [repForm, setRepForm] = useState({ bike_id: '', reparation_description: '' })
  const [returnForm, setReturnForm] = useState({ reservation_id: '', bike_id: '', return_state: '', problem_state: '', return_comment: '' })
  const [closeForm, setCloseForm] = useState({})
  const [msg, setMsg] = useState(null)
  const [error, setError] = useState(null)

  function notify(text, isError = false) {
    isError ? setError(text) : setMsg(text)
    setTimeout(() => isError ? setError(null) : setMsg(null), 4000)
  }

  async function load() {
    const [b, r, res, ret] = await Promise.all([fetchBikes(), fetchReparations(), fetchReservations(), fetchReturns()])
    setBikes(b)
    setReparations(r)
    setReservations(res)
    setReturnsHistory(ret)
  }

  useEffect(() => { load() }, [])

  async function handleCreateBike(e) {
    e.preventDefault()
    try {
      await createBike(bikeForm)
      setBikeForm({ bike_name: '', bike_code: '', bike_size: '', bike_description: '' })
      notify('Vélo ajouté avec succès.')
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCreateReparation(e) {
    e.preventDefault()
    try {
      await createReparation({ bike_id: parseInt(repForm.bike_id), reparation_description: repForm.reparation_description })
      setRepForm({ bike_id: '', reparation_description: '' })
      notify('Réparation créée.')
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCloseReparation(id) {
    const d = closeForm[id] || {}
    if (!d.end_date) { notify('Date de fin requise.', true); return }
    try {
      await closeReparation(id, { reparation_end_date: d.end_date, reparation_cost: d.cost ? parseFloat(d.cost) : null })
      notify('Réparation clôturée.')
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCreateReturn(e) {
    e.preventDefault()
    try {
      await createReturn({
        reservation_id: parseInt(returnForm.reservation_id),
        bike_id: parseInt(returnForm.bike_id),
        return_state: returnForm.return_state,
        problem_state: returnForm.problem_state,
        return_comment: returnForm.return_comment,
      })
      setReturnForm({ reservation_id: '', bike_id: '', return_state: '', problem_state: '', return_comment: '' })
      notify('Retour enregistré.')
    } catch (err) { notify(err.message, true) }
  }

  const openReparations = reparations.filter((r) => !r.reparation_end_date)

  if (mode === 'returns') {
    return (
      <div className="page">
        <h1>Historique des retours</h1>

        {msg && <div className="alert-success">{msg}</div>}
        {error && <div className="alert-error">{error}</div>}

        <section className="section">
          <h2>Retours enregistrés ({returnsHistory.length})</h2>
          {returnsHistory.length === 0 ? (
            <p className="empty-list">Aucun retour enregistre.</p>
          ) : (
            <table className="reservation-table">
              <thead>
                <tr><th>Date</th><th>Reservation</th><th>Velo</th><th>Etat</th><th>Problemes</th><th>Commentaire</th></tr>
              </thead>
              <tbody>
                {returnsHistory.map((item) => (
                  <tr key={item.return_id}>
                    <td>{item.return_date ? item.return_date.slice(0, 16).replace('T', ' ') : '-'}</td>
                    <td>{item.reservation_code || item.reservation_id}</td>
                    <td>{item.bike_name || item.bike_id}</td>
                    <td>{item.return_state || '-'}</td>
                    <td>{item.problem_state || 'Aucun'}</td>
                    <td>{item.return_comment || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Administration</h1>

      {msg && <div className="alert-success">{msg}</div>}
      {error && <div className="alert-error">{error}</div>}

      <section className="section">
        <h2>Réparations en cours ({openReparations.length})</h2>
        {openReparations.length === 0 ? (
          <p className="empty-list">Aucune réparation en cours.</p>
        ) : (
          <table className="reservation-table">
            <thead>
              <tr><th>Vélo</th><th>Description</th><th>Début</th><th>Date fin</th><th>Coût (€)</th><th>Action</th></tr>
            </thead>
            <tbody>
              {openReparations.map((r) => {
                const bike = bikes.find((b) => b.bike_id === r.bike_id)
                return (
                  <tr key={r.reparation_id}>
                    <td>{bike?.bike_name || r.bike_id}</td>
                    <td>{r.reparation_description}</td>
                    <td>{r.reparation_begin_date?.slice(0, 10)}</td>
                    <td>
                      <input type="date" value={closeForm[r.reparation_id]?.end_date || ''}
                        onChange={(e) => setCloseForm((p) => ({ ...p, [r.reparation_id]: { ...p[r.reparation_id], end_date: e.target.value } }))} />
                    </td>
                    <td>
                      <input type="number" placeholder="0.00" value={closeForm[r.reparation_id]?.cost || ''}
                        onChange={(e) => setCloseForm((p) => ({ ...p, [r.reparation_id]: { ...p[r.reparation_id], cost: e.target.value } }))} />
                    </td>
                    <td>
                      <button className="btn-primary" onClick={() => handleCloseReparation(r.reparation_id)}>Clore</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="section">
        <h2>Ajouter un vélo</h2>
        <form className="admin-form" onSubmit={handleCreateBike}>
          <input
            placeholder="Nom du vélo *"
            value={bikeForm.bike_name}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_name: e.target.value }))}
            required
          />
          <input
            placeholder="Code unique (ex: VL-042) *"
            value={bikeForm.bike_code}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_code: e.target.value }))}
            required
          />
          <select
            value={bikeForm.bike_size}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_size: e.target.value }))}
            required
          >
            <option value="">-- Taille du cadre --</option>
            {['XS (< 155 cm)', 'S (155–165 cm)', 'M (165–175 cm)', 'L (175–185 cm)', 'XL (> 185 cm)'].map((label) => (
              <option key={label} value={label.split(' ')[0]}>{label}</option>
            ))}
          </select>
          <textarea
            placeholder="Description (optionnel)"
            value={bikeForm.bike_description}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_description: e.target.value }))}
          />
          <button type="submit" className="btn-primary">Ajouter le vélo</button>
        </form>
      </section>

      <section className="section">
        <h2>Nouvelle réparation</h2>
        <form className="admin-form" onSubmit={handleCreateReparation}>
          <select value={repForm.bike_id} onChange={(e) => setRepForm((p) => ({ ...p, bike_id: e.target.value }))} required>
            <option value="">-- Sélectionner un vélo --</option>
            {bikes.map((b) => <option key={b.bike_id} value={b.bike_id}>{b.bike_name} ({b.bike_code})</option>)}
          </select>
          <textarea placeholder="Description de la réparation" value={repForm.reparation_description}
            onChange={(e) => setRepForm((p) => ({ ...p, reparation_description: e.target.value }))} required />
          <button type="submit" className="btn-primary">Créer la réparation</button>
        </form>
      </section>

      <section className="section">
        <h2>Enregistrer un retour</h2>
        <form className="admin-form" onSubmit={handleCreateReturn}>
          <select value={returnForm.reservation_id} onChange={(e) => setReturnForm((p) => ({ ...p, reservation_id: e.target.value }))} required>
            <option value="">-- Sélectionner une réservation --</option>
            {reservations.map((r) => {
              const bike = bikes.find((b) => b.bike_id === r.bike_id)
              return <option key={r.reservation_id} value={r.reservation_id}>{r.reservation_code} — {bike?.bike_name} ({r.reservation_date?.slice(0,10)})</option>
            })}
          </select>
          <select value={returnForm.bike_id} onChange={(e) => setReturnForm((p) => ({ ...p, bike_id: e.target.value }))} required>
            <option value="">-- Vélo retourné --</option>
            {bikes.map((b) => <option key={b.bike_id} value={b.bike_id}>{b.bike_name}</option>)}
          </select>
          <select value={returnForm.return_state} onChange={(e) => setReturnForm((p) => ({ ...p, return_state: e.target.value }))}>
            <option value="">État du retour</option>
            <option value="Bon état">Bon état</option>
            <option value="Endommagé">Endommagé</option>
          </select>
          <select value={returnForm.problem_state} onChange={(e) => setReturnForm((p) => ({ ...p, problem_state: e.target.value }))}>
            <option value="">Problème signalé</option>
            <option value="Aucun">Aucun</option>
            <option value="Crevaison">Crevaison</option>
            <option value="Frein défectueux">Frein défectueux</option>
            <option value="Autre">Autre</option>
          </select>
          <textarea placeholder="Commentaire (optionnel)" value={returnForm.return_comment}
            onChange={(e) => setReturnForm((p) => ({ ...p, return_comment: e.target.value }))} />
          <button type="submit" className="btn-primary">Enregistrer le retour</button>
        </form>
      </section>
    </div>
  )
}
