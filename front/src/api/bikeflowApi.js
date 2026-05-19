const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ description: res.statusText }))
    throw new Error(err.description || `Erreur ${res.status}`)
  }
  return res.json()
}

export const fetchBikes = () => request('/bikes')
export const createBike = (data) => request('/bikes', { method: 'POST', body: JSON.stringify(data) })
export const fetchUsers = () => request('/users')
export const createUser = (data) => request('/users', { method: 'POST', body: JSON.stringify(data) })
export const loginLocal = (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) })
export const registerLocal = (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) })
export const fetchReservations = (params = {}) => {
  const qs = new URLSearchParams(params).toString()
  return request(`/reservations${qs ? '?' + qs : ''}`)
}
export const createReservation = (data) => request('/reservations', { method: 'POST', body: JSON.stringify(data) })
export const cancelReservation = (id) => request(`/reservations/${id}/cancel`, { method: 'PATCH' })
export const fetchReparations = (bikeId = null) => {
  const qs = bikeId ? `?bike_id=${bikeId}` : ''
  return request(`/reparations${qs}`)
}
export const createReparation = (data) => request('/reparations', { method: 'POST', body: JSON.stringify(data) })
export const closeReparation = (id, data) => request(`/reparations/${id}/close`, { method: 'PATCH', body: JSON.stringify(data) })
export const fetchReturns = () => request('/returns')
export const createReturn = (data) => request('/returns', { method: 'POST', body: JSON.stringify(data) })
export const fetchReturn = (reservationId) => request(`/returns/${reservationId}`)

/**
 * Envoie un retour d'état avec photos (multipart/form-data).
 * @param {{reservation_id:number,bike_id:number,problem_state?:string,return_state?:string,return_comment?:string,mileage?:string,photos?:File[]}} data
 */
export async function createReturnWithPhotos(data) {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => {
    if (k === 'photos') return
    if (v !== null && v !== undefined && v !== '') fd.append(k, v)
  })
  ;(data.photos || []).forEach((f) => fd.append('photos', f))
  const res = await fetch(`${BASE_URL}/returns`, { method: 'POST', body: fd })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ description: res.statusText }))
    throw new Error(err.description || `Erreur ${res.status}`)
  }
  return res.json()
}
