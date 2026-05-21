import { useState, useCallback, useEffect, useMemo } from 'react'
import BikeCard from '../components/BikeCard.jsx'
import ReservationForm from '../components/ReservationForm.jsx'
import ReservationList from '../components/ReservationList.jsx'
import ReturnForm from '../components/ReturnForm.jsx'
import { fetchBikes, fetchUsers, fetchReservations, createReservation, cancelReservation, fetchMyStats } from '../api/bikeflowApi.js'
import { getGuestOwnerToken, loadGuestReservationIds, saveGuestReservationIds } from '../api/guestIdentity.js'

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

function ActivitySummary({ stats }) {
  if (!stats) return null
  return (
    <section className="activity-summary" aria-label="Activité personnelle">
      <div className="activity-card activity-card-primary">
        <span>Vélos loués</span>
        <strong>{stats.total_reservations}</strong>
      </div>
      <div className="activity-card">
        <span>Kilomètres</span>
        <strong>{stats.total_km}</strong>
      </div>
      <div className="activity-card">
        <span>Retours faits</span>
        <strong>{stats.returned_reservations}</strong>
      </div>
      <div className="activity-card">
        <span>Vélos différents</span>
        <strong>{stats.unique_bikes}</strong>
      </div>
      <div className="activity-card activity-card-wide">
        <span>Vélo favori</span>
        <strong>{stats.favorite_bike || '-'}</strong>
      </div>
      <div className="activity-card activity-card-wide">
        <span>Locations actives</span>
        <strong>{stats.active_reservations}</strong>
      </div>
    </section>
  )
}

function formatReservationDate(value) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function UpcomingReservations({ reservations, bikes }) {
  if (!reservations.length) return null

  function getBikeName(id) {
    return bikes.find((bike) => bike.bike_id === id)?.bike_name || `Vélo ${id}`
  }

  return (
    <section className="section upcoming-section">
      <h2>Mes prochaines réservations</h2>
      <div className="upcoming-list">
        {reservations.map((reservation) => (
          <div className="upcoming-item" key={reservation.reservation_id}>
            <div>
              <strong>{getBikeName(reservation.bike_id)}</strong>
              <span>{formatReservationDate(reservation.reservation_date)} - {formatReservationDate(reservation.return_date)}</span>
            </div>
            <code>{reservation.reservation_code}</code>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function HomePage({ currentUser = null }) {
  const [bikes, setBikes] = useState([])
  const [users, setUsers] = useState([])
  const [allReservations, setAllReservations] = useState([])
  const [slot, setSlot] = useState(getDefaultSlot)
  const [selectedBike, setSelectedBike] = useState(null)
  const [returnTarget, setReturnTarget] = useState(null)
  const [guestReservationIds, setGuestReservationIds] = useState(loadGuestReservationIds)
  const [activityStats, setActivityStats] = useState(null)
  const [error, setError] = useState(null)

  const refreshActivityStats = useCallback(async () => {
    if (!currentUser) {
      setActivityStats(null)
      return
    }
    try {
      setActivityStats(await fetchMyStats())
    } catch {
      setActivityStats(null)
    }
  }, [currentUser])

  useEffect(() => {
    fetchBikes().then(setBikes).catch((err) => setError(err.message || 'Impossible de charger les vélos.'))
    fetchUsers().then(setUsers).catch(() => {})
    fetchReservations().then(setAllReservations).catch(() => {})
  }, [])

  useEffect(() => {
    refreshActivityStats()
  }, [refreshActivityStats])

  useEffect(() => {
    if (typeof window === 'undefined') return
    getGuestOwnerToken()
    saveGuestReservationIds(guestReservationIds)
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
        availability_label: reservedOnSlot ? 'Réservé' : 'Disponible sur ce créneau',
        reserve_disabled: reservedOnSlot,
        status_variant: reservedOnSlot ? 'ko' : 'ok',
      }
    })
  }, [bikes, slot.reservation_date, slot.return_date, slotReservations])

  const upcomingReservations = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return allReservations
      .filter((reservation) => {
        const isMine = currentUser
          ? reservation.user_id === currentUser.user_id
          : guestReservationIds.includes(reservation.reservation_id)
        return isMine && reservation.return_date?.slice(0, 10) >= today
      })
      .sort((first, second) => new Date(first.reservation_date) - new Date(second.reservation_date))
      .slice(0, 3)
  }, [allReservations, currentUser, guestReservationIds])

  async function handleReserve(bike) {
    setError(null)
    setSlot(getDefaultSlot())
    setSelectedBike(bike)
  }

  async function handleSubmitReservation(data) {
    const created = await createReservation(data)
    if (!currentUser && created?.reservation_id) {
      setGuestReservationIds((currentIds) => Array.from(new Set([...currentIds, created.reservation_id])))
    }
    setSelectedBike(null)
    const [updatedBikes, updatedAll] = await Promise.all([fetchBikes(), fetchReservations()])
    setBikes(updatedBikes)
    setAllReservations(updatedAll)
    await refreshActivityStats()
  }

  async function handleCancel(id) {
    await cancelReservation(id)
    setGuestReservationIds((currentIds) => currentIds.filter((item) => item !== id))
    const [updatedBikes, updatedAll] = await Promise.all([fetchBikes(), fetchReservations()])
    setBikes(updatedBikes)
    setAllReservations(updatedAll)
    await refreshActivityStats()
  }

  function handleReturn(reservation) {
    setReturnTarget(reservation)
  }

  const visibleReservations = currentUser?.is_admin
    ? slotReservations
    : currentUser
      ? slotReservations.filter((item) => item.user_id === currentUser?.user_id)
      : slotReservations.filter((item) => guestReservationIds.includes(item.reservation_id))

  return (
    <div className="page">
      <section className="hero-panel">
        <div>
          <p className="hero-kicker">Plateforme interne</p>
          <h1>BikeFlow - Gestion vélos entreprise</h1>
          <p className="hero-copy">
            Consulte la flotte, réserve un vélo et retrouve ton historique personnel depuis ton compte Microsoft entreprise.
          </p>
        </div>
        <div className="hero-badge-card">
          <span className="hero-badge-label">Session</span>
          <strong>{currentUser.user_name}</strong>
          <p>{currentUser.role_name}</p>
        </div>
      </section>

      {error && <div className="alert-error">{error} <button onClick={() => setError(null)}>Fermer</button></div>}

      {currentUser && <ActivitySummary stats={activityStats} />}

      <UpcomingReservations reservations={upcomingReservations} bikes={bikesWithStatus} />

      <section className="section">
        <h2>Vélos disponibles</h2>
        <div className="bike-grid">
          {bikesWithStatus.map((b) => (
            <BikeCard key={b.bike_id} bike={b} onReserve={handleReserve} />
          ))}
        </div>
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
            await refreshActivityStats()
          }}
        />
      )}
    </div>
  )
}
