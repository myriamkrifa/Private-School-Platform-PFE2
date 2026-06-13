import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { createCalendarEvent, deleteCalendarEvent } from '../services/auth.service'

const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

const EVENT_TYPE_LABELS = {
  assignment: 'Assignment due',
  academic_year: 'Academic year',
  announcement: 'Announcement',
  custom: 'School event'
}

function buildCalendarDays(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  let startOffset = firstOfMonth.getDay() - 1
  if (startOffset < 0) startOffset = 6

  const start = new Date(year, month, 1 - startOffset)
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return day
  })
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function dateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateKey(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return dateKey(parsed)
}

function toInputDate(date) {
  return dateKey(date)
}

export default function DashboardCalendar({ events = [], onEventsChange, canManageEvents = false }) {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [menuOpen, setMenuOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({ title: '', date: '', description: '' })
  const menuRef = useRef(null)

  const days = useMemo(() => buildCalendarDays(viewDate), [viewDate])
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = useMemo(() => new Date(), [])

  const eventsByDate = useMemo(() => {
    const map = new Map()
    for (const event of events) {
      const key = toDateKey(event.date)
      if (!key) continue
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(event)
    }
    return map
  }, [events])

  const selectedDayEvents = eventsByDate.get(dateKey(selectedDate)) || []

  useEffect(() => {
    if (!menuOpen) return undefined
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const openAddModal = () => {
    setForm({ title: '', date: toInputDate(selectedDate), description: '' })
    setFormError('')
    setMenuOpen(false)
    setAddModalOpen(true)
  }

  const closeAddModal = () => {
    if (saving) return
    setAddModalOpen(false)
    setFormError('')
  }

  const submitEvent = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setFormError('Please enter an event title.')
      return
    }
    if (!form.date) {
      setFormError('Please select a date.')
      return
    }

    setSaving(true)
    setFormError('')
    try {
      await createCalendarEvent({
        title: form.title.trim(),
        date: form.date,
        description: form.description.trim() || undefined
      })
      setAddModalOpen(false)
      setForm({ title: '', date: '', description: '' })
      if (onEventsChange) await onEventsChange()
    } catch (error) {
      setFormError(error.response?.data?.message || 'Failed to add event.')
    } finally {
      setSaving(false)
    }
  }

  const removeEvent = async (calendarEvent) => {
    if (!calendarEvent.eventId || !calendarEvent.canDelete) return
    setDeletingId(calendarEvent.eventId)
    try {
      await deleteCalendarEvent(calendarEvent.eventId)
      if (onEventsChange) await onEventsChange()
    } catch (_error) {
      // keep list unchanged on failure
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="dashboard-calendar">
      <div className="dashboard-calendar-header">
        <div className="dashboard-calendar-title">
          <span className="dashboard-calendar-title-icon">
            <Calendar size={18} strokeWidth={2} aria-hidden />
          </span>
          <span>Calendar</span>
        </div>
        {canManageEvents ? (
          <div className="dashboard-calendar-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="dashboard-calendar-menu"
              aria-label="Calendar options"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} aria-hidden />
            </button>
            {menuOpen ? (
              <div className="dashboard-calendar-dropdown" role="menu">
                <button type="button" className="dashboard-calendar-dropdown-item" role="menuitem" onClick={openAddModal}>
                  <Plus size={16} aria-hidden />
                  Add event
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="dashboard-calendar-nav">
        <button type="button" className="dashboard-calendar-nav-btn" onClick={() => setViewDate((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} aria-label="Previous month">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <h4 className="dashboard-calendar-month">{monthLabel}</h4>
        <button type="button" className="dashboard-calendar-nav-btn" onClick={() => setViewDate((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} aria-label="Next month">
          <ChevronRight size={18} aria-hidden />
        </button>
      </div>

      <div className="dashboard-calendar-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day} className="dashboard-calendar-weekday">{day}</span>
        ))}
      </div>

      <div className="dashboard-calendar-grid">
        {days.map((day) => {
          const inCurrentMonth = day.getMonth() === viewDate.getMonth()
          const selected = isSameDay(day, selectedDate)
          const isToday = isSameDay(day, today)
          const dayEvents = eventsByDate.get(dateKey(day)) || []
          const hasEvent = dayEvents.length > 0

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={[
                'dashboard-calendar-day',
                !inCurrentMonth ? 'is-outside' : '',
                selected ? 'is-selected' : '',
                !selected && isToday ? 'is-today' : '',
                hasEvent ? 'has-event' : ''
              ].filter(Boolean).join(' ')}
              onClick={() => setSelectedDate(day)}
            >
              <span className="dashboard-calendar-day-number">{day.getDate()}</span>
              {hasEvent ? <span className="dashboard-calendar-day-dot" aria-hidden /> : null}
            </button>
          )
        })}
      </div>

      <div className="dashboard-calendar-events">
        <p className="dashboard-calendar-events-label">
          {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
        {selectedDayEvents.length ? (
          <ul className="dashboard-calendar-events-list">
            {selectedDayEvents.map((event) => (
              <li key={event.id} className={`dashboard-calendar-event dashboard-calendar-event--${event.type}`}>
                <div className="dashboard-calendar-event-main">
                  <span className="dashboard-calendar-event-type">{EVENT_TYPE_LABELS[event.type] || 'Event'}</span>
                  <span className="dashboard-calendar-event-title">{event.title}</span>
                  {event.detail ? <span className="dashboard-calendar-event-detail">{event.detail}</span> : null}
                </div>
                {event.canDelete && event.type === 'custom' ? (
                  <button
                    type="button"
                    className="dashboard-calendar-event-delete"
                    onClick={() => removeEvent(event)}
                    disabled={deletingId === event.eventId}
                    aria-label={`Delete ${event.title}`}
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="dashboard-calendar-events-empty">No events on this day.</p>
        )}
      </div>

      {addModalOpen ? (
        <div className="dashboard-calendar-modal-overlay" role="presentation" onClick={closeAddModal}>
          <div className="dashboard-calendar-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h4 className="dashboard-calendar-modal-title">Add calendar event</h4>
            <form onSubmit={submitEvent} className="dashboard-calendar-modal-form">
              <label className="dashboard-calendar-field">
                <span>Title</span>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required />
              </label>
              <label className="dashboard-calendar-field">
                <span>Date</span>
                <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} required />
              </label>
              <label className="dashboard-calendar-field">
                <span>Description (optional)</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </label>
              {formError ? <p className="dashboard-calendar-form-error">{formError}</p> : null}
              <div className="dashboard-calendar-modal-actions">
                <button type="button" className="dashboard-calendar-btn-secondary" onClick={closeAddModal} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm btn-inline" disabled={saving}>{saving ? 'Saving...' : 'Add event'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
