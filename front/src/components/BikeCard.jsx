const SIZE_LABELS = {
  XS: '1m45-1m60',
  S: '1m50-1m75',
  M: '1m55-1m80',
  L: '1m65-1m90',
  XL: '1m75-2m00',
}

function formatBikeName(name) {
  return /^\d+$/.test(String(name)) ? `Velo ${name}` : name
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

function BikeIllustration({ variant }) {
  if (variant === 'stepthrough') {
    return (
      <svg viewBox="0 0 320 190" className="bike-visual" role="img" aria-label="Illustration d'un velo col de cygne">
        <defs>
          <linearGradient id="bg-step" x1="0" x2="1">
            <stop offset="0%" stopColor="#f8fbf7" />
            <stop offset="100%" stopColor="#edf6ed" />
          </linearGradient>
        </defs>
        <rect width="320" height="190" fill="url(#bg-step)" rx="24" />
        <circle cx="95" cy="138" r="42" fill="none" stroke="#2d3a31" strokeWidth="5" />
        <circle cx="230" cy="138" r="42" fill="none" stroke="#2d3a31" strokeWidth="5" />
        <path d="M96 138 L136 88 L187 88 L148 138 Z" fill="none" stroke="#557a63" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M137 88 Q171 57 213 97" fill="none" stroke="#557a63" strokeWidth="6" strokeLinecap="round" />
        <path d="M187 88 L230 138" fill="none" stroke="#557a63" strokeWidth="6" strokeLinecap="round" />
        <path d="M148 138 L188 138" fill="none" stroke="#557a63" strokeWidth="6" strokeLinecap="round" />
        <path d="M182 70 L196 52" fill="none" stroke="#2d3a31" strokeWidth="5" strokeLinecap="round" />
        <path d="M191 54 L215 59" fill="none" stroke="#2d3a31" strokeWidth="5" strokeLinecap="round" />
        <path d="M124 78 L112 58" fill="none" stroke="#2d3a31" strokeWidth="5" strokeLinecap="round" />
        <path d="M103 58 L126 58" fill="none" stroke="#2d3a31" strokeWidth="5" strokeLinecap="round" />
        <path d="M141 87 L171 122" fill="none" stroke="#b08657" strokeWidth="6" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 320 190" className="bike-visual" role="img" aria-label="Illustration d'un velo trapeze">
      <defs>
        <linearGradient id="bg-trapeze" x1="0" x2="1">
          <stop offset="0%" stopColor="#f8f9fd" />
          <stop offset="100%" stopColor="#eef2ff" />
        </linearGradient>
      </defs>
      <rect width="320" height="190" fill="url(#bg-trapeze)" rx="24" />
      <circle cx="95" cy="138" r="42" fill="none" stroke="#263140" strokeWidth="5" />
      <circle cx="230" cy="138" r="42" fill="none" stroke="#263140" strokeWidth="5" />
      <path d="M95 138 L138 82 L183 82 L148 138 Z" fill="none" stroke="#667fbd" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M138 82 L199 108" fill="none" stroke="#667fbd" strokeWidth="6" strokeLinecap="round" />
      <path d="M183 82 L230 138" fill="none" stroke="#667fbd" strokeWidth="6" strokeLinecap="round" />
      <path d="M148 138 L188 138" fill="none" stroke="#667fbd" strokeWidth="6" strokeLinecap="round" />
      <path d="M179 65 L191 48" fill="none" stroke="#263140" strokeWidth="5" strokeLinecap="round" />
      <path d="M189 50 L213 55" fill="none" stroke="#263140" strokeWidth="5" strokeLinecap="round" />
      <path d="M129 73 L118 55" fill="none" stroke="#263140" strokeWidth="5" strokeLinecap="round" />
      <path d="M109 55 L131 55" fill="none" stroke="#263140" strokeWidth="5" strokeLinecap="round" />
      <path d="M141 82 L168 119" fill="none" stroke="#a97d50" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}

export default function BikeCard({ bike, onReserve, canReserve = false }) {
  const family = getBikeFamily(bike.bike_description)
  const bikeName = formatBikeName(bike.bike_name)
  const bikeType = getBikeTypeLabel(bike.bike_description)
  const bikeSize = getBikeSizeLabel(bike.bike_size)
  const statusLabel = bike.availability_label || (bike.is_available ? 'Disponible' : 'Indisponible')
  const reserveDisabled = bike.reserve_disabled ?? !bike.is_available
  const statusClass = bike.status_variant === 'ko' ? 'status-ko' : 'status-ok'
  const reserveClass = bike.status_variant === 'ko' ? 'btn-reserve btn-reserve-danger' : 'btn-reserve'

  return (
    <div className={`bike-card ${bike.is_available ? 'available' : 'unavailable'}`}>
      <div className={`bike-card-media ${family}`}>
        <BikeIllustration variant={family} />
      </div>
      <div className="bike-card-body">
        <h3>{bikeName}</h3>
        <p className="bike-type">{bikeType}</p>
        <p className="bike-size">{bikeSize}</p>
      </div>
      <div className={`bike-status ${statusClass}`}>
        {statusLabel}
      </div>
      {canReserve ? (
        <button
          className={reserveClass}
          onClick={() => onReserve(bike)}
          disabled={reserveDisabled}
        >
          {reserveDisabled ? 'Déjà pris' : 'Réserver'}
        </button>
      ) : null}
    </div>
  )
}
