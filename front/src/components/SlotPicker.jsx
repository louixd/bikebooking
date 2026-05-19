import { useMemo, useState } from 'react'

// Génère toutes les heures et demi-heures de 08:00 à 18:00
function generateTimeOptions() {
  const times = []
  for (let h = 8; h <= 18; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 18) {
      times.push(`${String(h).padStart(2, '0')}:30`)
    }
  }
  return times
}
const TIME_OPTIONS = generateTimeOptions()

function formatMonthLabel(date) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date)
}

function buildCalendarDays(cursorDate, today) {
  const year = cursorDate.getFullYear()
  const month = cursorDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const startOffset = (firstDay.getDay() + 6) % 7
  const startDate = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const value = new Date(startDate)
    value.setDate(startDate.getDate() + index)
    return {
      key: value.toISOString(),
      date: value,
      iso: value.toISOString().split('T')[0],
      isCurrentMonth: value.getMonth() === month,
      isPast: value < today,
    }
  })
}

export default function SlotPicker({ value, onChange }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString().split('T')[0]
  const selectedDate = value.start_date || todayIso
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [monthCursor, setMonthCursor] = useState(() => {
    const base = selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const calendarDays = useMemo(() => buildCalendarDays(monthCursor, today), [monthCursor, todayIso])

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
    <div className="slot-picker slot-picker-calendar">
      <div className="slot-picker-calendar-panel">
        <div className="slot-picker-calendar-head">
          <div>
            <label>Date de réservation</label>
            <button
              type="button"
              className="calendar-trigger"
              onClick={() => setIsCalendarOpen((prev) => !prev)}
            >
              {selectedDate}
            </button>
          </div>
          <span className="calendar-hours-badge">08:00 - 18:00</span>
        </div>

        {isCalendarOpen && (
          <div className="calendar-popover">
            <div className="calendar-toolbar">
              <button type="button" className="calendar-nav" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                {'<'}
              </button>
              <strong>{formatMonthLabel(monthCursor)}</strong>
              <button type="button" className="calendar-nav" onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                {'>'}
              </button>
            </div>
            <div className="calendar-weekdays">
              {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="calendar-grid">
              {calendarDays.map((day) => (
                <button
                  type="button"
                  key={day.key}
                  className={`calendar-day ${day.isCurrentMonth ? '' : 'muted'} ${day.iso === selectedDate ? 'selected' : ''}`.trim()}
                  disabled={day.isPast}
                  onClick={() => {
                    update({
                      start_date: day.iso,
                      end_date: day.iso,
                      date: day.iso,
                      start_time: value.start_time || '08:00',
                      end_time: value.end_time || '09:00',
                    })
                    setIsCalendarOpen(false)
                  }}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="slot-picker-date">
        <label htmlFor="slot-start-time">Début</label>
        <select
          id="slot-start-time"
          value={value.start_time || ''}
          onChange={(e) => update({ start_time: e.target.value, start_date: selectedDate, end_date: selectedDate, date: selectedDate })}
          disabled={!selectedDate}
        >
          <option value="">--:--</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="slot-picker-date">
        <label htmlFor="slot-end-time">Retour</label>
        <select
          id="slot-end-time"
          value={value.end_time || ''}
          onChange={(e) => update({ end_time: e.target.value, start_date: selectedDate, end_date: selectedDate, date: selectedDate })}
          disabled={!selectedDate}
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
          Le <strong>{value.start_date}</strong>, de <strong>{value.start_time}</strong> à <strong>{value.end_time}</strong>
        </p>
      )}
    </div>
  )
}
