import { useMemo, useState, useEffect } from 'react'
import { fetchBikes, fetchReparations, createReparation, closeReparation, fetchReservations, createBike, updateBike, fetchReturns, fetchUsers, cancelReservation } from '../api/bikeflowApi.js'

const BIKE_SIZES = ['XS', 'S', 'M', 'L', 'XL']

export default function AdminPage({ mode = 'manage' }) {
  const [bikes, setBikes] = useState([])
  const [reparations, setReparations] = useState([])
  const [reservations, setReservations] = useState([])
  const [returnsHistory, setReturnsHistory] = useState([])
  const [users, setUsers] = useState([])
  const [bikeForm, setBikeForm] = useState({ bike_name: '', bike_code: '', bike_size: '', bike_description: '', bike_quantity: 1 })
  const [editingBikeId, setEditingBikeId] = useState(null)
  const [editBikeForm, setEditBikeForm] = useState({ bike_name: '', bike_code: '', bike_size: '', bike_description: '', is_available: true })
  const [repForm, setRepForm] = useState({ bike_id: '', reparation_description: '' })
  const [closeForm, setCloseForm] = useState({})
  const [error, setError] = useState(null)

  function notify(text, isError = false) {
    if (!isError) return
    setError(text)
    setTimeout(() => setError(null), 4000)
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
      await createBike({ ...bikeForm, bike_quantity: Number(bikeForm.bike_quantity) || 1 })
      setBikeForm({ bike_name: '', bike_code: '', bike_size: '', bike_description: '', bike_quantity: 1 })
      load()
    } catch (err) { notify(err.message, true) }
  }

  function startEditBike(bike) {
    setEditingBikeId(bike.bike_id)
    setEditBikeForm({
      bike_name: bike.bike_name || '',
      bike_code: bike.bike_code || '',
      bike_size: bike.bike_size || '',
      bike_description: bike.bike_description || '',
      is_available: !!bike.is_available,
    })
  }

  function cancelEditBike() {
    setEditingBikeId(null)
    setEditBikeForm({ bike_name: '', bike_code: '', bike_size: '', bike_description: '', is_available: true })
  }

  async function handleUpdateBike(e) {
    e.preventDefault()
    if (!editingBikeId) return
    try {
      await updateBike(editingBikeId, editBikeForm)
      cancelEditBike()
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCreateReparation(e) {
    e.preventDefault()
    try {
      await createReparation({ bike_id: parseInt(repForm.bike_id), reparation_description: repForm.reparation_description })
      setRepForm({ bike_id: '', reparation_description: '' })
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleCloseReparation(id) {
    const d = closeForm[id] || {}
    if (!d.end_date) { notify('Date de fin requise.', true); return }
    try {
      await closeReparation(id, { reparation_end_date: d.end_date, reparation_cost: d.cost ? parseFloat(d.cost) : null })
      load()
    } catch (err) { notify(err.message, true) }
  }

  async function handleDeleteReservation(id) {
    try {
      await cancelReservation(id, { admin: true, guestOwnerToken: false })
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

  const quantityByFrame = useMemo(() => {
    return bikes.reduce((acc, bike) => {
      const label = bike.bike_description?.toLowerCase().includes('cygne') ? 'Col de cygne' : 'Trapèze'
      acc[label] = (acc[label] || 0) + 1
      return acc
    }, {})
  }, [bikes])

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
      totalBikes: bikes.length,
      totalReservations: reservations.length,
      totalUsers: users.length,
      topPeople,
    }
  }, [bikes.length, reservations, users])

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

      {error && <div className="alert-error">{error}</div>}

      <section className="section">
        <h2>Dashboard</h2>
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <span className="dashboard-label">Vélos</span>
            <strong>{dashboard.totalBikes}</strong>
            <p>Quantité totale dans la flotte.</p>
          </div>
          <div className="dashboard-card">
            <span className="dashboard-label">Reservations</span>
            <strong>{dashboard.totalReservations}</strong>
            <p>Total des réservations actives.</p>
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
        <div className="quantity-summary">
          {Object.entries(quantityByFrame).map(([label, count]) => (
            <span key={label}>{label}: <strong>{count}</strong></span>
          ))}
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
        <h2>Modifier les vélos</h2>
        {bikes.length === 0 ? (
          <p className="empty-list">Aucun vélo enregistré.</p>
        ) : (
          <div className="admin-bike-manager">
            <table className="reservation-table admin-bike-table">
              <thead>
                <tr><th>Nom</th><th>Code</th><th>Taille</th><th>Type</th><th>Statut</th><th>Action</th></tr>
              </thead>
              <tbody>
                {bikes.map((bike) => (
                  <tr key={bike.bike_id} className={editingBikeId === bike.bike_id ? 'admin-bike-row-active' : ''}>
                    <td>{bike.bike_name}</td>
                    <td><code>{bike.bike_code}</code></td>
                    <td>{bike.bike_size}</td>
                    <td>{bike.bike_description || '-'}</td>
                    <td>
                      <span className={`return-state-pill ${bike.is_available ? 'ok' : 'danger'}`}>
                        {bike.is_available ? 'Disponible' : 'Indisponible'}
                      </span>
                    </td>
                    <td>
                      <button className="btn-secondary" onClick={() => startEditBike(bike)}>Modifier</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {editingBikeId && (
              <form className="admin-form admin-edit-bike-form" onSubmit={handleUpdateBike}>
                <h3>Modifier {editBikeForm.bike_name}</h3>
                <input
                  placeholder="Nom du vélo *"
                  value={editBikeForm.bike_name}
                  onChange={(e) => setEditBikeForm((p) => ({ ...p, bike_name: e.target.value }))}
                  required
                />
                <input
                  placeholder="Code unique *"
                  value={editBikeForm.bike_code}
                  onChange={(e) => setEditBikeForm((p) => ({ ...p, bike_code: e.target.value }))}
                  required
                />
                <select
                  value={editBikeForm.bike_size}
                  onChange={(e) => setEditBikeForm((p) => ({ ...p, bike_size: e.target.value }))}
                  required
                >
                  <option value="">-- Taille du cadre --</option>
                  {BIKE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <textarea
                  placeholder="Description / type de cadre"
                  value={editBikeForm.bike_description}
                  onChange={(e) => setEditBikeForm((p) => ({ ...p, bike_description: e.target.value }))}
                />
                <label className="admin-checkbox-row">
                  <input
                    type="checkbox"
                    checked={editBikeForm.is_available}
                    onChange={(e) => setEditBikeForm((p) => ({ ...p, is_available: e.target.checked }))}
                  />
                  Disponible à la réservation
                </label>
                <div className="admin-form-actions">
                  <button type="button" className="btn-secondary" onClick={cancelEditBike}>Annuler</button>
                  <button type="submit" className="btn-primary">Enregistrer</button>
                </div>
              </form>
            )}
          </div>
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
            placeholder="Code de base (ex: VL-042) *"
            value={bikeForm.bike_code}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_code: e.target.value }))}
            required
          />
          <input
            type="number"
            min="1"
            max="50"
            placeholder="Quantité *"
            value={bikeForm.bike_quantity}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_quantity: e.target.value }))}
            required
          />
          <select
            value={bikeForm.bike_size}
            onChange={(e) => setBikeForm((p) => ({ ...p, bike_size: e.target.value }))}
            required
          >
            <option value="">-- Taille du cadre --</option>
            {['XS (< 155 cm)', 'S (155-165 cm)', 'M (165-175 cm)', 'L (175-185 cm)', 'XL (> 185 cm)'].map((label) => (
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
        <p className="admin-form-hint">Si la quantité est supérieure à 1, les codes seront créés automatiquement avec un suffixe: VL-042-01, VL-042-02...</p>
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

    </div>
  )
}
