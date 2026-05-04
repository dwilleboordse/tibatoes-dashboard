import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { fmtMoney, fmtPct } from '../lib/format'

const STATUS = [
  ['planned',       'Planned',       'muted'],
  ['in_production', 'In production', 'cyan'],
  ['live',          'Live',          'violet'],
  ['paused',        'Paused',        'amber'],
  ['killed',        'Killed',        'red'],
]
const RESULT = [
  ['pending',      'Pending',      'muted'],
  ['winner',       'Winner',       'green'],
  ['loser',        'Loser',        'red'],
  ['inconclusive', 'Inconclusive', 'amber'],
]
const AWARENESS = [
  ['unaware',          'Unaware'],
  ['problem_aware',    'Problem aware'],
  ['solution_aware',   'Solution aware'],
  ['product_aware',    'Product aware'],
  ['most_aware',       'Most aware'],
]

const STATUS_TONE = Object.fromEntries(STATUS.map(([v, , t]) => [v, t]))
const STATUS_LABEL = Object.fromEntries(STATUS.map(([v, l]) => [v, l]))
const RESULT_TONE = Object.fromEntries(RESULT.map(([v, , t]) => [v, t]))
const RESULT_LABEL = Object.fromEntries(RESULT.map(([v, l]) => [v, l]))
const AWARENESS_LABEL = Object.fromEntries(AWARENESS.map(([v, l]) => [v, l]))

const empty = {
  status: 'planned', batch_number: '', ad_concept: '',
  avatar: '', mass_desire: '', awareness_level: 'problem_aware',
  ad_type: '', ad_format: '',
  test_result: 'pending', spend: 0, learnings: '', creative_hit_rate: null,
}

export default function CreativeRoadmap() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('creative_roadmap').select('*').order('created_at', { ascending: false })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return rows.filter(r =>
      (!statusFilter || r.status === statusFilter) &&
      (!resultFilter || r.test_result === resultFilter) &&
      (!batchFilter || (r.batch_number ?? '').toLowerCase().includes(batchFilter.toLowerCase())) &&
      (!s || [r.ad_concept, r.avatar, r.mass_desire, r.learnings].some(v => (v ?? '').toLowerCase().includes(s)))
    )
  }, [rows, search, statusFilter, resultFilter, batchFilter])

  const totals = useMemo(() => {
    const total = rows.length
    const winners = rows.filter(r => r.test_result === 'winner').length
    const decided = rows.filter(r => r.test_result === 'winner' || r.test_result === 'loser').length
    const spend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0)
    return { total, winners, decided, spend, hitRate: decided ? (winners / decided) * 100 : 0 }
  }, [rows])

  function openNew() { setEditing({ ...empty }); setOpen(true) }
  function openEdit(r) { setEditing(r); setOpen(true) }

  async function save() {
    const { id, created_at, updated_at, ...payload } = editing
    payload.spend = Number(payload.spend) || 0
    payload.creative_hit_rate = payload.creative_hit_rate === '' || payload.creative_hit_rate == null ? null : Number(payload.creative_hit_rate)
    if (id) await supabase.from('creative_roadmap').update(payload).eq('id', id)
    else    await supabase.from('creative_roadmap').insert(payload)
    setOpen(false); load()
  }
  async function remove() {
    if (!editing?.id) return
    if (!confirm('Delete this test?')) return
    await supabase.from('creative_roadmap').delete().eq('id', editing.id)
    setOpen(false); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Creative Roadmap</h2>
          <div className="sub">Every test, batch, and learning in one place.</div>
        </div>
        <button className="btn primary" onClick={openNew}><Plus size={16}/> New test</button>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="stat-label">Tests logged</span>
          <span className="stat-value">{totals.total}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Winners</span>
          <span className="stat-value green">{totals.winners}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Hit rate</span>
          <span className="stat-value">{fmtPct(totals.hitRate)}</span>
          <span className="stat-sub">winners / decided tests</span>
        </div>
        <div className="stat">
          <span className="stat-label">Total spend</span>
          <span className="stat-value">{fmtMoney(totals.spend)}</span>
        </div>
      </div>

      <div className="filters">
        <input placeholder="Search concept, avatar, learnings…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <input placeholder="Batch #" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} style={{ width: 120 }}/>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}>
          <option value="">All results</option>
          {RESULT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 1300 }}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Batch</th>
              <th>Ad concept</th>
              <th>Avatar</th>
              <th>Mass desire</th>
              <th>Awareness</th>
              <th>Type</th>
              <th>Format</th>
              <th>Result</th>
              <th className="numeric">Spend</th>
              <th className="numeric">Hit rate</th>
              <th>Learnings</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ display: 'inline-block' }}/></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={13} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {rows.length === 0 ? 'No tests logged yet. Click "New test" to add the first one.' : 'No tests match these filters.'}
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => openEdit(r)} style={{ cursor: 'pointer' }}>
                <td><span className={'chip ' + (STATUS_TONE[r.status] ?? 'muted')}>{STATUS_LABEL[r.status]}</span></td>
                <td>{r.batch_number || '—'}</td>
                <td style={{ maxWidth: 240, fontWeight: 500 }}>{r.ad_concept}</td>
                <td>{r.avatar || '—'}</td>
                <td>{r.mass_desire || '—'}</td>
                <td>{r.awareness_level ? AWARENESS_LABEL[r.awareness_level] : '—'}</td>
                <td>{r.ad_type || '—'}</td>
                <td>{r.ad_format || '—'}</td>
                <td><span className={'chip ' + (RESULT_TONE[r.test_result] ?? 'muted')}>{RESULT_LABEL[r.test_result]}</span></td>
                <td className="numeric">{fmtMoney(r.spend)}</td>
                <td className="numeric">{r.creative_hit_rate == null ? '—' : fmtPct(r.creative_hit_rate)}</td>
                <td style={{ maxWidth: 320, color: 'var(--text-secondary)', fontSize: 12.5 }}>
                  {r.learnings ? (r.learnings.length > 80 ? r.learnings.slice(0, 80) + '…' : r.learnings) : '—'}
                </td>
                <td><button className="icon-btn" onClick={(e) => { e.stopPropagation(); openEdit(r) }}><Pencil/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open} onClose={() => setOpen(false)}
        large
        title={editing?.id ? 'Edit test' : 'New test'}
        footer={
          <>
            {editing?.id && <button className="btn" onClick={remove}><Trash2 size={14}/> Delete</button>}
            <div style={{ flex: 1 }}/>
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!editing?.ad_concept}>Save</button>
          </>
        }
      >
        {editing && (
          <>
            <div className="row cols-3" style={{ gap: 12 }}>
              <div className="field">
                <label>Status</label>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Batch #</label>
                <input value={editing.batch_number ?? ''} onChange={(e) => setEditing({ ...editing, batch_number: e.target.value })} placeholder="e.g. B-2026-04"/>
              </div>
              <div className="field">
                <label>Result</label>
                <select value={editing.test_result} onChange={(e) => setEditing({ ...editing, test_result: e.target.value })}>
                  {RESULT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Ad concept</label>
              <input value={editing.ad_concept} onChange={(e) => setEditing({ ...editing, ad_concept: e.target.value })} placeholder="What is this ad about?" autoFocus/>
            </div>
            <div className="row cols-2" style={{ gap: 12 }}>
              <div className="field"><label>Avatar</label><input value={editing.avatar ?? ''} onChange={(e) => setEditing({ ...editing, avatar: e.target.value })}/></div>
              <div className="field"><label>Mass desire</label><input value={editing.mass_desire ?? ''} onChange={(e) => setEditing({ ...editing, mass_desire: e.target.value })}/></div>
            </div>
            <div className="row cols-3" style={{ gap: 12 }}>
              <div className="field">
                <label>Awareness</label>
                <select value={editing.awareness_level ?? ''} onChange={(e) => setEditing({ ...editing, awareness_level: e.target.value || null })}>
                  <option value="">—</option>
                  {AWARENESS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field"><label>Ad type</label><input value={editing.ad_type ?? ''} onChange={(e) => setEditing({ ...editing, ad_type: e.target.value })} placeholder="Hook-led, problem/solution…"/></div>
              <div className="field"><label>Ad format</label><input value={editing.ad_format ?? ''} onChange={(e) => setEditing({ ...editing, ad_format: e.target.value })} placeholder="UGC, static, carousel…"/></div>
            </div>
            <div className="row cols-2" style={{ gap: 12 }}>
              <div className="field">
                <label>Spend ($)</label>
                <input type="number" value={editing.spend ?? 0} onChange={(e) => setEditing({ ...editing, spend: e.target.value })}/>
              </div>
              <div className="field">
                <label>Creative hit rate (%)</label>
                <input type="number" step="0.1" value={editing.creative_hit_rate ?? ''} onChange={(e) => setEditing({ ...editing, creative_hit_rate: e.target.value })} placeholder="leave blank if N/A"/>
              </div>
            </div>
            <div className="field">
              <label>Learnings</label>
              <textarea rows={4} value={editing.learnings ?? ''} onChange={(e) => setEditing({ ...editing, learnings: e.target.value })} placeholder="What did this teach us?"/>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
