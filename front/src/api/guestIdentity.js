const GUEST_OWNER_COOKIE = 'bikeflow_guest_owner'
const GUEST_RESERVATIONS_COOKIE = 'bikeflow_guest_reservations'
const LEGACY_SESSION_RESERVATIONS_KEY = 'bikeflow-guest-reservations'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

function cookieOptions() {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  return `Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

function getCookie(name) {
  if (typeof document === 'undefined') return null
  const prefix = `${name}=`
  const item = document.cookie.split('; ').find((part) => part.startsWith(prefix))
  return item ? decodeURIComponent(item.slice(prefix.length)) : null
}

function setCookie(name, value) {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=${encodeURIComponent(value)}; ${cookieOptions()}`
}

function createGuestOwnerToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function normalizeReservationIds(value) {
  return Array.isArray(value)
    ? value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
    : []
}

export function getGuestOwnerToken() {
  const existing = getCookie(GUEST_OWNER_COOKIE)
  if (existing) return existing
  const token = createGuestOwnerToken()
  setCookie(GUEST_OWNER_COOKIE, token)
  return token
}

export function loadGuestReservationIds() {
  try {
    const cookieValue = getCookie(GUEST_RESERVATIONS_COOKIE)
    if (cookieValue) return normalizeReservationIds(JSON.parse(cookieValue))
  } catch {
    setCookie(GUEST_RESERVATIONS_COOKIE, '[]')
  }

  try {
    const legacyValue = typeof window !== 'undefined'
      ? window.sessionStorage.getItem(LEGACY_SESSION_RESERVATIONS_KEY)
      : null
    const legacyIds = legacyValue ? normalizeReservationIds(JSON.parse(legacyValue)) : []
    if (legacyIds.length) saveGuestReservationIds(legacyIds)
    return legacyIds
  } catch {
    return []
  }
}

export function saveGuestReservationIds(ids) {
  const uniqueIds = Array.from(new Set(normalizeReservationIds(ids)))
  setCookie(GUEST_RESERVATIONS_COOKIE, JSON.stringify(uniqueIds))
  return uniqueIds
}