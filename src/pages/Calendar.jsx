import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'

const TYPES = [
  ['general',    'General',    'violet'],
  ['launch',     'Launch',     'green'],
  ['promotion',  'Promotion',  'amber'],
  ['content',    'Content',    'cyan'],
  ['meeting',    'Meeting',    'red'],
  ['milestone',  'Milestone',  'violet'],
]
const TONE = Object.fromEntries(TYPES.map(([v, , t]) => [v, t]))
const LABEL = Object.fromEntries(TYPES.map(([v, l]) => [v, l]))

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ymd(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}
function startOfMonthMatrix(year, month) {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Monday-first
  return new Date(year, month, 1 - offset)
}

export default function Calendar() {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    const start = startOfMonthMatrix(cursor.getFullYear(), cursor.getMonth())
    const end = new Date(start); end.setDate(start.getDate() + 42)
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', ymd(start))
      .lt('event_date', ymd(end))
      .order('event_date')
    setEvents(data ?? [])
  }
  useEffect(() => { load() }, [cursor])

  const days = useMemo(() => {
    const start = startOfMonthMatrix(cursor.getFullYear(), cursor.getMonth())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d
    })
  }, [cursor])

  const eventsByDay = useMemo(() => {
    const m = {}
    events.forEach(e => { (m[e.event_date] = m[e.event_date] || []).push(e) })
    return m
  }, [events])

  function openNew(date) {
    setEditing({
      title: '', description: '',
      event_date: ymd(date), end_date: '',
      event_type: 'general',
    })
    setShowModal(true)
  }
  function openEdit(ev) { setEditing({ ...ev, end_date: ev.end_date ?? '' }); setShowModal(true) }

  async function save() {
    const payload = {
      title: editing.title, description: editing.description,
      event_date: editing.event_date,
      end_date: editing.end_date || null,
      event_type: editing.event_type,
    }
    if (editing.id) {
      await supabase.from('calendar_events').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('calendar_events').insert(payload)
    }
    setShowModal(false); load()
  }
  async function remove() {
    if (!editing?.id) return
    if (!confirm('Delete this event?')) return
    await supabase.from('calendar_events').delete().eq('id', editing.id)
    setShowModal(false); load()
  }

  const monthLabel = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Calendar</h2>
          <div className="sub">Plan launches, promos, content, and milestones.</div>
        </div>
        <button className="btn primary" onClick={() => openNew(today)}><Plus size={16} /> New event</button>
      </div>

      <div className="card">
        <div className="cal-toolbar">
          <h3>{monthLabel}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><ChevronLeft size={16}/></button>
            <button className="btn ghost" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
            <button className="btn ghost" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><ChevronRight size={16}/></button>
          </div>
        </div>

        <div className="cal-grid">
          {DOW.map(d => <div key={d} className="cal-dow">{d}</div>)}
          {days.map((d) => {
            const inMonth = d.getMonth() === cursor.getMonth()
            const isToday = ymd(d) === ymd(today)
            const dayEvents = eventsByDay[ymd(d)] ?? []
            return (
              <div
                key={ymd(d)}
                className={'cal-day' + (inMonth ? '' : ' muted') + (isToday ? ' today' : '')}
                onClick={() => openNew(d)}
              >
                <span className="cal-num">{d.getDate()}</span>
                {dayEvents.slice(0, 3).map(ev => (
                  <div
                    key={ev.id}
                    className={'cal-event ' + (TONE[ev.event_type] || 'violet')}
                    onClick={(e) => { e.stopPropagation(); openEdit(ev) }}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>+ {dayEvents.length - 3} more</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing?.id ? 'Edit event' : 'New event'}
        footer={
          <>
            {editing?.id && <button className="btn" onClick={remove}><Trash2 size={14}/> Delete</button>}
            <div style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!editing?.title}>Save</button>
          </>
        }
      >
        {editing && (
          <>
            <div className="field">
              <label>Title</label>
              <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} autoFocus/>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={3} value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}/>
            </div>
            <div className="row cols-3" style={{ gap: 12 }}>
              <div className="field">
                <label>Type</label>
                <select value={editing.event_type} onChange={(e) => setEditing({ ...editing, event_type: e.target.value })}>
                  {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date</label>
                <input type="date" value={editing.event_date} onChange={(e) => setEditing({ ...editing, event_date: e.target.value })}/>
              </div>
              <div className="field">
                <label>End (optional)</label>
                <input type="date" value={editing.end_date ?? ''} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })}/>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
