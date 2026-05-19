import { useMemo, useState, useEffect } from 'react'
import { fetchBikes, fetchReparations, createReparation, closeReparation, fetchReservations, createReturn, createBike, fetchReturns, fetchUsers, cancelReservation } from '../api/bikeflowApi.js'

export default function AdminPage({ mode = 'manage' }) {
  const [bikes, setBikes] = useState([])
  const [reparations, setReparations] = useState([])
  const [reservations, setReservations] = useState([])
  const [returnsHistory, setReturnsHistory] = useState([])
  const [users, setUsers] = useState([])
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
    const [b, r, res, ret, usr] = await Promise.all([fetchBikes(), fetchReparations(), fetchReservations(), fetchReturns(), fetchUsers()])
    setBikes(b)
    setReparations(r)
    setReservations(res)
    setReturnsHistory(ret)
    setUsers(usr)
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
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleDeleteReservation(id) {
    try {
      await cancelReservation(id)
      notify('Réservation supprimée.')
      load()
    } catch (err) { notify(err.message, true) }
  }

  function getReservationUserLabel(reservation) {
    return reservation.user_name_free || users.find((user) => user.user_id === reservation.user_id)?.user_name || `Utilisateur ${reservation.user_id}`
  }

  function getBikeLabel(bikeId) {
    const bike = bikes.find((item) => item.bike_id === bikeId)
    return bike ? `${bike.bike_name} (${bike.bike_code})` : `Vélo ${bikeId}`
  }

  const openReparations = reparations.filter((r) => !r.reparation_end_date)
  const dashboard = useMemo(() => {
    const reservationsByPerson = new Map()
    reservations.forEach((item) => {
      const label = item.user_name_free || users.find((user) => user.user_id === item.user_id)?.user_name || `Utilisateur ${item.user_id}`
      reservationsByPerson.set(label, (reservationsByPerson.get(label) || 0) + 1)
    })
    const topPeople = Array.from(reservationsByPerson.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return {
      totalReservations: reservations.length,
      totalReturns: returnsHistory.length,
      totalUsers: users.length,
      topPeople,
    }
  }, [reservations, returnsHistory, users])

  if (mode === 'returns') {
    const flaggedReturns = returnsHistory.filter((item) => item.return_state === 'ko' || (item.problem_state && item.problem_state !== 'Aucun'))
    return (
      <div className="page returns-page">
        <section className="returns-hero">
          <div>
            <p className="hero-kicker">Suivi atelier</p>
            <h1>Historique des retours</h1>
            <p className="hero-copy">Retrouve rapidement les vélos revenus en bon état et ceux qui demandent un contrôle.</p>
          </div>
          <div className="returns-summary-grid">
            <article className="returns-summary-card">
              <span>Total retours</span>
              <strong>{returnsHistory.length}</strong>
            </article>
            <article className="returns-summary-card returns-summary-alert">
              <span>À vérifier</span>
              <strong>{flaggedReturns.length}</strong>
            </article>
          </div>
        </section>

        {msg && <div className="alert-success">{msg}</div>}
        {error && <div className="alert-error">{error}</div>}

        <section className="section returns-table-section">
          <h2>Retours enregistrés ({returnsHistory.length})</h2>
          {returnsHistory.length === 0 ? (
            <p className="empty-list">Aucun retour enregistré.</p>
          ) : (
            <table className="reservation-table returns-table">
              <thead>
                <tr><th>Date</th><th>Réservation</th><th>Vélo</th><th>État</th><th>Problèmes</th><th>Commentaire</th></tr>
              </thead>
              <tbody>
                {returnsHistory.map((item) => (
                  <tr key={item.return_id} className={item.return_state === 'ko' || (item.problem_state && item.problem_state !== 'Aucun') ? 'return-row-alert' : ''}>
                    <td>{item.return_date ? item.return_date.slice(0, 16).replace('T', ' ') : '-'}</td>
                    <td>{item.reservation_code || item.reservation_id}</td>
                    <td>{item.bike_name || item.bike_id}</td>
                    <td>
                      <span className={`return-state-pill ${item.return_state === 'ko' ? 'danger' : 'ok'}`}>
                        {item.return_state || '-'}
                      </span>
                    </td>
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
        <h2>Dashboard</h2>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <span className="dashboard-label">Reservations</span>
            <strong>{dashboard.totalReservations}</strong>
            <p>Total des réservations actives.</p>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-label">Retours</span>
            <strong>{dashboard.totalReturns}</strong>
            <p>Retours déjà saisis par l'équipe.</p>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-label">Reparations</span>
            <strong>{openReparations.length}</strong>
            <p>Vélos actuellement immobilisés.</p>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-label">Utilisateurs</span>
            <strong>{dashboard.totalUsers}</strong>
            <p>Comptes recensés en base locale.</p>
          </div>
        </div>
        <div className="dashboard-split">
          <div className="dashboard-panel">
            <h3>Personnes qui réservent le plus</h3>
            {dashboard.topPeople.length === 0 ? (
              <p className="empty-list">Aucune réservation enregistrée.</p>
            ) : (
              <div className="dashboard-list">
                {dashboard.topPeople.map(([name, count]) => (
                  <div key={name} className="dashboard-list-item">
                    <span>{name}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="dashboard-panel dashboard-panel-warning">
            <h3>Consignes de sécurité</h3>
            <p>Vérifier les freins, la pression des pneus et l'éclairage avant chaque départ.</p>
            <p>Porter un casque, signaler toute chute et ne jamais laisser le vélo sans antivol.</p>
            <p>Au retour, refermer l'antivol, ranger le vélo à sa place et déclarer tout incident dans l'outil.</p>
          </div>
        </div>
      </section>

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
        <h2>Réservations actives</h2>
        {reservations.length === 0 ? (
          <p className="empty-list">Aucune réservation active.</p>
        ) : (
          <table className="reservation-table">
            <thead>
              <tr><th>Code</th><th>Personne</th><th>Vélo</th><th>Début</th><th>Fin</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {reservations.map((reservation) => (
                <tr key={reservation.reservation_id}>
                  <td><code>{reservation.reservation_code}</code></td>
                  <td>{getReservationUserLabel(reservation)}</td>
                  <td>{getBikeLabel(reservation.bike_id)}</td>
                  <td>{reservation.reservation_date?.replace('T', ' ').slice(0, 16)}</td>
                  <td>{reservation.return_date?.replace('T', ' ').slice(0, 16)}</td>
                  <td className="admin-reservation-actions">
                    <button className="btn-cancel" onClick={() => handleDeleteReservation(reservation.reservation_id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
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
