import { useState, useEffect, useCallback } from 'react'
import BikeCard from '../components/BikeCard.jsx'
import ReservationForm from '../components/ReservationForm.jsx'
import ReservationList from '../components/ReservationList.jsx'
import ReturnForm from '../components/ReturnForm.jsx'
import { fetchBikes, fetchUsers, fetchReservations, createReservation, cancelReservation } from '../api/bikeflowApi.js'

const EMPTY_SLOT = { date: '', start_date: '', start_time: '', end_date: '', end_time: '', reservation_date: null, return_date: null, error: null }

export default function HomePage({ currentUser = null, onRequireAuth }) {
  const [bikes, setBikes] = useState([])
  const [users, setUsers] = useState([])
  const [reservations, setReservations] = useState([])
  const [allReservations, setAllReservations] = useState([])
  const [slot, setSlot] = useState(EMPTY_SLOT)
  const [selectedBike, setSelectedBike] = useState(null)
  const [returnTarget, setReturnTarget] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBikes().then(setBikes).catch((err) => setError(err.message || 'Impossible de charger les velos.'))
    fetchUsers().then(setUsers).catch(() => {})
    fetchReservations().then(setAllReservations).catch(() => {})
  }, [])

  const loadReservations = useCallback(() => {
    if (!slot.start_date) return
    const params = { date: slot.start_date }
    fetchReservations(params).then(setReservations).catch(() => {})
  }, [slot.start_date])

  useEffect(() => { loadReservations() }, [loadReservations])

  async function handleReserve(bike) {
    if (!currentUser) {
      setError('Connecte-toi pour reserver un velo.')
      onRequireAuth?.('login')
      return
    }
    setError(null)
    setSlot(EMPTY_SLOT)
    setSelectedBike(bike)
  }

  async function handleSubmitReservation(data) {
    const created = await createReservation(data)
    setSelectedBike(null)
    setSlot(EMPTY_SLOT)
    setSuccessMsg(
      `Reservation ${created.reservation_code} confirmee. Un email recapitulatif a ete envoye a l'equipe.`
    )
    const [updatedBikes, updatedAll] = await Promise.all([fetchBikes(), fetchReservations()])
    setBikes(updatedBikes)
    setAllReservations(updatedAll)
    loadReservations()
  }

  async function handleCancel(id) {
    await cancelReservation(id)
    loadReservations()
    fetchReservations().then(setAllReservations).catch(() => {})
  }

  function handleReturn(reservation) {
    if (!currentUser) {
      setError('Connecte-toi pour enregistrer un retour.')
      onRequireAuth?.('login')
      return
    }
    setReturnTarget(reservation)
  }

  const visibleReservations = currentUser?.is_admin
    ? reservations
    : reservations.filter((item) => item.user_id === currentUser?.user_id)

  return (
    <div className="page">
      <section className="hero-panel">
        <div>
          <p className="hero-kicker">Plateforme interne</p>
          <h1>BikeFlow - Gestion velos entreprise</h1>
          <p className="hero-copy">
            Reserve un velo rapidement, suis tes retours terrain et garde la flotte disponible avec un acces local plus simple.
          </p>
        </div>
        <div className="hero-badge-card">
          <span className="hero-badge-label">Session</span>
          <strong>{currentUser ? currentUser.user_name : 'Invite'}</strong>
          <p>{currentUser ? currentUser.role_name : 'Connecte-toi pour reserver et faire un retour.'}</p>
        </div>
      </section>

      {error && <div className="alert-error">{error} <button onClick={() => setError(null)}>Fermer</button></div>}
      {successMsg && (
        <div className="alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem' }}>Fermer</button>
        </div>
      )}

      <section className="section">
        <h2>Vélos disponibles</h2>
        <div className="bike-grid">
          {bikes.map((b) => (
            <BikeCard key={b.bike_id} bike={b} onReserve={handleReserve} />
          ))}
        </div>
      </section>

      {slot.start_date && (
        <section className="section">
          <h2>{currentUser?.is_admin ? 'Reservations du' : 'Mes reservations du'} {slot.start_date}{slot.end_date && slot.end_date !== slot.start_date ? ` au ${slot.end_date}` : ''}</h2>
          <ReservationList
            reservations={visibleReservations}
            bikes={bikes}
            users={users}
            currentUser={currentUser}
            onCancel={handleCancel}
            onReturn={handleReturn}
          />
        </section>
      )}

      {selectedBike && (
        <ReservationForm
          bike={selectedBike}
          slot={slot}
          onSlotChange={setSlot}
          currentUser={currentUser}
          onSubmit={handleSubmitReservation}
          onCancel={() => {
            setSelectedBike(null)
            setSlot(EMPTY_SLOT)
          }}
        />
      )}

      {returnTarget && (
        <ReturnForm
          reservation={returnTarget}
          bike={bikes.find((b) => b.bike_id === returnTarget.bike_id)}
          onClose={() => setReturnTarget(null)}
          onSuccess={() => { /* keep modal open until user clicks Fermer */ }}
        />
      )}
    </div>
  )
}
