import colDeCygneImage from '../assets/bike-col-de-cygne.svg'
import trapezeImage from '../assets/bike-trapeze.svg'

const SIZE_LABELS = {
  XS: '1m45-1m60',
  S: '1m50-1m75',
  M: '1m55-1m80',
  L: '1m65-1m90',
  XL: '1m75-2m00',
}

function formatBikeName(name) {
  return /^\d+$/.test(String(name)) ? `Vélo ${name}` : name
}

function getBikeFamily(description = '') {
  return description.toLowerCase().includes('cygne') ? 'stepthrough' : 'trapeze'
}

function getBikeTypeLabel(description = '') {
  const cleaned = description.replace(/^cadre en\s+/i, '').trim()
  return cleaned ? cleaned[0].toUpperCase() + cleaned.slice(1) : 'Polyvalent'
}

function getBikeSizeLabel(size = '') {
  return SIZE_LABELS.M || size || '1m55-1m80'
}

export default function BikeCard({ bike, onReserve }) {
  const family = getBikeFamily(bike.bike_description)
  const bikeName = formatBikeName(bike.bike_name)
  const bikeType = getBikeTypeLabel(bike.bike_description)
  const bikeSize = getBikeSizeLabel(bike.bike_size)
  const statusLabel = bike.availability_label || (bike.is_available ? 'Disponible' : 'Indisponible')
  const reserveDisabled = bike.reserve_disabled ?? !bike.is_available
  const statusClass = bike.status_variant === 'ko' ? 'status-ko' : 'status-ok'
  const reserveClass = bike.status_variant === 'ko' ? 'btn-reserve btn-reserve-danger' : 'btn-reserve'
  const reserveButtonLabel = reserveDisabled
    ? statusLabel === 'En maintenance' ? 'Indisponible' : 'Réservé'
    : 'Réserver'
  const bikeImage = family === 'stepthrough' ? colDeCygneImage : trapezeImage
  const familyLabel = family === 'stepthrough' ? 'Col de cygne' : 'Trapèze'

  return (
    <div className={`bike-card ${bike.is_available ? 'available' : 'unavailable'}`}>
      <div className={`bike-card-media ${family}`}>
        <img className="bike-visual" src={bikeImage} alt={`Vélo ${familyLabel.toLowerCase()}`} />
        <span className="bike-frame-label">{familyLabel}</span>
      </div>
      <div className="bike-card-body">
        <h3>{bikeName}</h3>
        <p className="bike-type">{bikeType}</p>
        <p className="bike-size">{bikeSize}</p>
      </div>
      <div className={`bike-status ${statusClass}`}>
        {statusLabel}
      </div>
      <button
        className={reserveClass}
        onClick={() => onReserve(bike)}
        disabled={reserveDisabled}
      >
        {reserveButtonLabel}
      </button>
    </div>
  )
}
