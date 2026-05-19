// Génère toutes les heures et demi-heures de 00:00 à 23:30
function generateTimeOptions() {
  const times = []
  for (let h = 0; h < 24; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    times.push(`${String(h).padStart(2, '0')}:30`)
  }
  return times
}
const TIME_OPTIONS = generateTimeOptions()

export default function SlotPicker({ value, onChange }) {
  const today = new Date().toISOString().split('T')[0]

  function update(patch) {
    const next = { ...value, ...patch }
    // Recalculer reservation_date et return_date si tout est rempli
    if (next.start_date && next.start_time && next.end_date && next.end_time) {
      const resDate = `${next.start_date}T${next.start_time}:00`
      const retDate = `${next.end_date}T${next.end_time}:00`
      if (retDate > resDate) {
        next.reservation_date = resDate
        next.return_date = retDate
        next.error = null
      } else {
        next.reservation_date = null
        next.return_date = null
        next.error = "L'heure de fin doit être après l'heure de début."
      }
    } else {
      next.reservation_date = null
      next.return_date = null
      next.error = null
    }
    onChange(next)
  }

  return (
    <div className="slot-picker" style={{ flexWrap: 'wrap', gap: '1rem' }}>
      {/* Date début */}
      <div className="slot-picker-date">
        <label htmlFor="slot-start-date">Date de début</label>
        <input
          id="slot-start-date"
          type="date"
          min={today}
          value={value.start_date || ''}
          onChange={(e) => {
            const d = e.target.value
            // Si date fin est avant date début, on la remet à jour
            const end_date = value.end_date && value.end_date >= d ? value.end_date : d
            update({ start_date: d, end_date, date: d })
          }}
        />
      </div>

      {/* Heure début */}
      <div className="slot-picker-date">
        <label htmlFor="slot-start-time">Heure de début</label>
        <select
          id="slot-start-time"
          value={value.start_time || ''}
          onChange={(e) => update({ start_time: e.target.value })}
          disabled={!value.start_date}
        >
          <option value="">--:--</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Date fin */}
      <div className="slot-picker-date">
        <label htmlFor="slot-end-date">Date de fin</label>
        <input
          id="slot-end-date"
          type="date"
          min={value.start_date || today}
          value={value.end_date || ''}
          onChange={(e) => update({ end_date: e.target.value })}
          disabled={!value.start_date}
        />
      </div>

      {/* Heure fin */}
      <div className="slot-picker-date">
        <label htmlFor="slot-end-time">Heure de fin</label>
        <select
          id="slot-end-time"
          value={value.end_time || ''}
          onChange={(e) => update({ end_time: e.target.value })}
          disabled={!value.end_date}
        >
          <option value="">--:--</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Résumé / erreur */}
      {value.error && (
        <p style={{ color: '#e74c3c', fontSize: '0.85rem', width: '100%', marginTop: '0.25rem' }}>
          {value.error}
        </p>
      )}
      {value.reservation_date && value.return_date && (
        <p style={{ color: '#27ae60', fontSize: '0.85rem', width: '100%', marginTop: '0.25rem' }}>
          Du <strong>{value.start_date} a {value.start_time}</strong> au <strong>{value.end_date} a {value.end_time}</strong>
        </p>
      )}
    </div>
  )
}
