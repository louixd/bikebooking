const GUEST_TOKEN_KEY = 'bikeflow-guest-owner-token'
const GUEST_RESERVATIONS_KEY = 'bikeflow-guest-reservation-ids'
const LEGACY_GUEST_RESERVATIONS_KEY = 'bikeflow-my-reservation-ids'

function randomToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `guest-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getGuestOwnerToken() {
  if (typeof window === 'undefined') return ''
  let token = localStorage.getItem(GUEST_TOKEN_KEY)
  if (!token) {
    token = randomToken()
    localStorage.setItem(GUEST_TOKEN_KEY, token)
  }
  return token
}

export function loadGuestReservationIds() {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(GUEST_RESERVATIONS_KEY)
  if (raw) {
    try {
      return JSON.parse(raw).map(Number).filter(Boolean)
    } catch {
      localStorage.removeItem(GUEST_RESERVATIONS_KEY)
    }
  }

  const legacyRaw = localStorage.getItem(LEGACY_GUEST_RESERVATIONS_KEY)
  if (!legacyRaw) return []
  try {
    const legacyIds = JSON.parse(legacyRaw).map(Number).filter(Boolean)
    if (legacyIds.length) saveGuestReservationIds(legacyIds)
    return legacyIds
  } catch {
    localStorage.removeItem(LEGACY_GUEST_RESERVATIONS_KEY)
    return []
  }
}

export function saveGuestReservationIds(ids) {
  if (typeof window === 'undefined') return
  localStorage.setItem(GUEST_RESERVATIONS_KEY, JSON.stringify(Array.from(new Set(ids))))
}