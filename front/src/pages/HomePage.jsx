import { useState, useEffect, useMemo } from 'react'
import BikeCard from '../components/BikeCard.jsx'
import ReservationForm from '../components/ReservationForm.jsx'
import ReservationList from '../components/ReservationList.jsx'
import ReturnForm from '../components/ReturnForm.jsx'
import { fetchBikes, fetchUsers, fetchReservations, fetchReservation, fetchReturn, createReservation, cancelReservation } from '../api/bikeflowApi.js'

const GUEST_RESERVATIONS_KEY = 'bikeflow-guest-reservations'
const DEFAULT_QUICK_SLOT = { quick_slot: 'morning', start_time: '08:00', end_time: '12:00' }

function buildSlotState(partial = {}) {
  const startDate = partial.start_date || partial.date || ''
  const endDate = partial.end_date || startDate || ''
  const startTime = partial.start_time || ''
  const endTime = partial.end_time || ''

  return {
    quick_slot: partial.quick_slot || 'custom',
    date: startDate,
    start_date: startDate,
    start_time: startTime,
    end_date: endDate,
    end_time: endTime,
    reservation_date: startDate && startTime ? `${startDate}T${startTime}:00` : null,
    return_date: endDate && endTime ? `${endDate}T${endTime}:00` : null,
    error: null,
  }
}

function getDefaultSlot() {
  const today = new Date().toISOString().split('T')[0]
  return buildSlotState({ ...DEFAULT_QUICK_SLOT, start_date: today, end_date: today, date: today })
}

function loadGuestReservationIds() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.sessionStorage.getItem(GUEST_RESERVATIONS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => Number.isInteger(item)) : []
  } catch {
    return []
  }
}

export default function HomePage({ currentUser = null, onRequireAuth }) {
  const canReserve = !!currentUser?.is_admin
  const [bikes, setBikes] = useState([])
  const [users, setUsers] = useState([])
  const [allReservations, setAllReservations] = useState([])
  const [slot, setSlot] = useState(getDefaultSlot)
  const [selectedBike, setSelectedBike] = useState(null)
  const [returnTarget, setReturnTarget] = useState(null)
  const [guestReservationIds, setGuestReservationIds] = useState(loadGuestReservationIds)
  const [pendingReturnReservations, setPendingReturnReservations] = useState([])
  const [successMsg, setSuccessMsg] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBikes().then(setBikes).catch((err) => setError(err.message || 'Impossible de charger les velos.'))
    fetchUsers().then(setUsers).catch(() => {})
    fetchReservations().then(setAllReservations).catch(() => {})
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(GUEST_RESERVATIONS_KEY, JSON.stringify(guestReservationIds))
  }, [guestReservationIds])

  useEffect(() => {
    let isMounted = true

    async function loadPendingReservations() {
      if (!guestReservationIds.length) {
        if (isMounted) setPendingReturnReservations([])
        return
      }

      const items = await Promise.all(guestReservationIds.map(async (reservationId) => {
        try {
          const reservation = await fetchReservation(reservationId)
          try {
            await fetchReturn(reservationId)
            return null
          } catch {
            return reservation
          }
        } catch {
          return null
        }
      }))

      if (isMounted) {
        setPendingReturnReservations(items.filter(Boolean))
      }
    }

    loadPendingReservations()
    return () => {
      isMounted = false
    }
  }, [guestReservationIds])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    if (selectedBike || returnTarget) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [selectedBike, returnTarget])

  const slotReservations = useMemo(() => {
    if (!slot.reservation_date || !slot.return_date) return []
    const start = new Date(slot.reservation_date)
    const end = new Date(slot.return_date)
    return allReservations.filter((item) => {
      const itemStart = new Date(item.reservation_date)
      const itemEnd = new Date(item.return_date)
      return itemStart < end && itemEnd > start
    })
  }, [allReservations, slot.reservation_date, slot.return_date])

  const bikesWithStatus = useMemo(() => {
    return bikes.map((bike) => {
      const reservedOnSlot = slotReservations.some((item) => item.bike_id === bike.bike_id)
      if (!slot.reservation_date || !slot.return_date) {
        return {
          ...bike,
          availability_label: bike.is_available ? 'Disponible' : 'En maintenance',
          reserve_disabled: !bike.is_available,
          status_variant: bike.is_available ? 'ok' : 'ko',
        }
      }
      if (!bike.is_available) {
        return {
          ...bike,
          is_available: false,
          availability_label: 'En maintenance',
          reserve_disabled: true,
          status_variant: 'ko',
        }
      }
      return {
        ...bike,
        is_available: !reservedOnSlot,
        availability_label: reservedOnSlot ? 'Déjà réservé' : 'Disponible sur ce créneau',
        reserve_disabled: reservedOnSlot,
        status_variant: reservedOnSlot ? 'ko' : 'ok',
      }
    })
  }, [bikes, slot.reservation_date, slot.return_date, slotReservations])

  async function handleReserve(bike) {
    setError(null)
    setSlot(getDefaultSlot())
    setSelectedBike(bike)
  }

  async function handleSubmitReservation(data) {
    const created = await createReservation(data)
    if (created?.reservation_id) {
      setGuestReservationIds((currentIds) => Array.from(new Set([...currentIds, created.reservation_id])))
    }
    setSelectedBike(null)
    setSuccessMsg(
      `Réservation ${created.reservation_code} confirmée. Un e-mail récapitulatif a été envoyé à l'équipe.`
    )
    const [updatedBikes, updatedAll] = await Promise.all([fetchBikes(), fetchReservations()])
    setBikes(updatedBikes)
    setAllReservations(updatedAll)
  }

  async function handleCancel(id) {
    await cancelReservation(id)
    const [updatedBikes, updatedAll] = await Promise.all([fetchBikes(), fetchReservations()])
    setBikes(updatedBikes)
    setAllReservations(updatedAll)
    setSuccessMsg("Réservation annulée. Tu peux encore enregistrer un retour d'état ci-dessous.")
  }

  function handleReturn(reservation) {
    setReturnTarget(reservation)
  }

  const visibleReservations = currentUser?.is_admin
    ? slotReservations
    : currentUser
      ? slotReservations.filter((item) => item.user_id === currentUser?.user_id)
      : slotReservations.filter((item) => guestReservationIds.includes(item.reservation_id))

  const returnableReservations = useMemo(() => {
    return pendingReturnReservations.filter(
      (item) => !allReservations.some((activeReservation) => activeReservation.reservation_id === item.reservation_id)
    )
  }, [allReservations, pendingReturnReservations])

  return (
    <div className="page">
      <section className="hero-panel">
        <div>
          <p className="hero-kicker">Plateforme interne</p>
          <h1>BikeFlow - Gestion vélos entreprise</h1>
          <p className="hero-copy">
            Consulte la flotte, suis les retours terrain et réserve depuis un compte administrateur.
          </p>
        </div>
        <div className="hero-badge-card">
          <span className="hero-badge-label">Session</span>
          <strong>{currentUser ? currentUser.user_name : 'Invité'}</strong>
          <p>{currentUser ? currentUser.role_name : "Connexion administrateur requise pour réserver."}</p>
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
          {bikesWithStatus.map((b) => (
            <BikeCard key={b.bike_id} bike={b} onReserve={handleReserve} canReserve={canReserve} />
          ))}
        </div>
        {!canReserve && (
          <p className="reservation-admin-note">
            Le bouton de réservation est visible uniquement pour l'administration.
          </p>
        )}
      </section>

      {slot.start_date && (
        <section className="section">
          <h2>{currentUser?.is_admin ? 'Réservations du' : currentUser ? 'Mes réservations du' : 'Réservations du'} {slot.start_date}{slot.end_date && slot.end_date !== slot.start_date ? ` au ${slot.end_date}` : ''}</h2>
          <ReservationList
            reservations={visibleReservations}
            bikes={bikesWithStatus}
            users={users}
            currentUser={currentUser}
            guestReservationIds={guestReservationIds}
            onCancel={handleCancel}
            onReturn={handleReturn}
          />
        </section>
      )}

      {returnableReservations.length > 0 && (
        <section className="section">
          <h2>Retours à compléter</h2>
          <p className="modal-info" style={{ marginBottom: '1rem' }}>
            Après une annulation, tu peux encore signaler un pneu crevé, un frein défectueux ou tout autre problème.
          </p>
          <ReservationList
            reservations={returnableReservations}
            bikes={bikes}
            users={users}
            currentUser={currentUser}
            guestReservationIds={guestReservationIds}
            onReturn={handleReturn}
            showCancel={false}
          />
        </section>
      )}

      {selectedBike && (
        <ReservationForm
          bike={selectedBike}
          bikeStatus={bikesWithStatus.find((item) => item.bike_id === selectedBike.bike_id) || selectedBike}
          slot={slot}
          onSlotChange={setSlot}
          currentUser={currentUser}
          onSubmit={handleSubmitReservation}
          onCancel={() => {
            setSelectedBike(null)
            setSlot(getDefaultSlot())
          }}
        />
      )}

      {returnTarget && (
        <ReturnForm
          reservation={returnTarget}
          bike={bikes.find((b) => b.bike_id === returnTarget.bike_id)}
          onClose={() => setReturnTarget(null)}
          onSuccess={async () => {
            await cancelReservation(returnTarget.reservation_id)
            setGuestReservationIds((currentIds) => currentIds.filter((item) => item !== returnTarget.reservation_id))
            const [updatedBikes, updatedAll] = await Promise.all([fetchBikes(), fetchReservations()])
            setBikes(updatedBikes)
            setAllReservations(updatedAll)
            setPendingReturnReservations((currentItems) => currentItems.filter((item) => item.reservation_id !== returnTarget.reservation_id))
          }}
        />
      )}
    </div>
  )
}
