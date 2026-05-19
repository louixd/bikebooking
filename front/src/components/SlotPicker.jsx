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

function getNextTimeSlot(timeValue) {
  const currentIndex = TIME_OPTIONS.indexOf(timeValue)
  if (currentIndex === -1) return '09:00'
  return TIME_OPTIONS[Math.min(currentIndex + 1, TIME_OPTIONS.length - 1)]
}

export default function SlotPicker({ value, onChange }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayIso = today.toISOString().split('T')[0]
  const selectedDate = value.start_date || ''

  function update(patch) {
    const next = { ...value, ...patch }
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

  function handleDateChange(nextDate) {
    update({
      start_date: nextDate,
      end_date: nextDate,
      date: nextDate,
      start_time: value.start_time || '08:00',
      end_time: value.end_time || '09:00',
    })
  }

  function handleStartTimeChange(nextStartTime) {
    const nextEndTime = !value.end_time || value.end_time <= nextStartTime
      ? getNextTimeSlot(nextStartTime)
      : value.end_time

    update({
      start_time: nextStartTime,
      end_time: nextEndTime,
      start_date: selectedDate || todayIso,
      end_date: selectedDate || todayIso,
      date: selectedDate || todayIso,
    })
  }

  return (
    <div className="slot-picker slot-picker-simple">
      <div className="slot-step-card slot-step-date">
        <label htmlFor="slot-start-date">Date</label>
        <input
          id="slot-start-date"
          type="date"
          min={todayIso}
          value={selectedDate}
          onChange={(e) => handleDateChange(e.target.value)}
        />
      </div>

      <div className="slot-step-card">
        <label htmlFor="slot-start-time">Début</label>
        <select
          id="slot-start-time"
          value={value.start_time || ''}
          onChange={(e) => handleStartTimeChange(e.target.value)}
          disabled={!selectedDate}
        >
          <option value="">--:--</option>
          {TIME_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="slot-step-card">
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

      {value.error && (
        <p className="slot-feedback slot-feedback-error">
          {value.error}
        </p>
      )}
      {value.reservation_date && value.return_date && (
        <p className="slot-feedback slot-feedback-ok">
          Le <strong>{value.start_date}</strong>, de <strong>{value.start_time}</strong> à <strong>{value.end_time}</strong>
        </p>
      )}
    </div>
  )
}
