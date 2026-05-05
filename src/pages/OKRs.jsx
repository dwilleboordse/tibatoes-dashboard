import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, Rocket } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import { fmtNum, progressFor, STATUS_TONE } from '../lib/format'

const OKR_STATUSES = [
  ['on_track', 'On track'],
  ['at_risk', 'At risk'],
  ['off_track', 'Off track'],
  ['achieved', 'Achieved'],
  ['missed', 'Missed'],
]

const INIT_STATUSES = [
  ['not_started', 'Not started', 'muted'],
  ['in_progress', 'In progress', 'cyan'],
  ['blocked',     'Blocked',     'red'],
  ['done',        'Done',        'green'],
  ['dropped',     'Dropped',     'muted'],
]
const INIT_TONE = Object.fromEntries(INIT_STATUSES.map(([v, , t]) => [v, t]))
const INIT_LABEL = Object.fromEntries(INIT_STATUSES.map(([v, l]) => [v, l]))

const QUARTERS = [1, 2, 3, 4]

export default function OKRs() {
  const { user } = useAuth()
  const [year, setYear] = useState(new Date().getFullYear())
  const [okrs, setOkrs] = useState([])
  const [krs, setKrs] = useState([])
  const [inits, setInits] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingOkr, setEditingOkr] = useState(null)
  const [editingKr, setEditingKr] = useState(null)
  const [editingInit, setEditingInit] = useState(null)
  const [showOkrModal, setShowOkrModal] = useState(false)
  const [showKrModal, setShowKrModal] = useState(false)
  const [showInitModal, setShowInitModal] = useState(false)
  const [krParentId, setKrParentId] = useState(null)
  const [initParentOkrId, setInitParentOkrId] = useState(null)

  async function load() {
    setLoading(true)
    const [{ data: o }, { data: k }, { data: i }] = await Promise.all([
      supabase.from('okrs').select('*').eq('year', year).order('quarter').order('created_at'),
      supabase.from('key_results').select('*').order('position').order('created_at'),
      supabase.from('initiatives').select('*').order('position').order('created_at'),
    ])
    setOkrs(o ?? []); setKrs(k ?? []); setInits(i ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [year])

  // ── OKR CRUD ────────────────────────────────────────────────
  function openNewOkr() { setEditingOkr({ year, quarter: 1, objective: '', description: '', status: 'on_track' }); setShowOkrModal(true) }
  function openEditOkr(o) { setEditingOkr(o); setShowOkrModal(true) }
  async function saveOkr() {
    const payload = { ...editingOkr, owner_id: editingOkr.owner_id ?? user?.id }
    if (payload.id) {
      await supabase.from('okrs').update({
        objective: payload.objective, description: payload.description,
        year: payload.year, quarter: payload.quarter, status: payload.status,
      }).eq('id', payload.id)
    } else {
      await supabase.from('okrs').insert(payload)
    }
    setShowOkrModal(false); load()
  }
  async function deleteOkr(id) {
    if (!confirm('Delete this objective and all its key results & initiatives?')) return
    await supabase.from('okrs').delete().eq('id', id); load()
  }

  // ── KR CRUD ─────────────────────────────────────────────────
  function openNewKr(okrId) {
    setKrParentId(okrId)
    setEditingKr({ title: '', unit: '%', start_value: 0, target_value: 100, current_value: 0, direction: 'max' })
    setShowKrModal(true)
  }
  function openEditKr(kr) { setKrParentId(kr.okr_id); setEditingKr(kr); setShowKrModal(true) }
  async function saveKr() {
    const payload = { ...editingKr, okr_id: krParentId }
    if (payload.id) {
      await supabase.from('key_results').update({
        title: payload.title, unit: payload.unit,
        start_value: payload.start_value, target_value: payload.target_value,
        current_value: payload.current_value, direction: payload.direction,
      }).eq('id', payload.id)
    } else {
      await supabase.from('key_results').insert(payload)
    }
    setShowKrModal(false); load()
  }
  async function deleteKr(id) {
    if (!confirm('Delete this key result?')) return
    await supabase.from('key_results').delete().eq('id', id); load()
  }

  // ── Initiative CRUD ─────────────────────────────────────────
  function openNewInit(okrId) {
    setInitParentOkrId(okrId)
    setEditingInit({ title: '', description: '', status: 'not_started', key_result_id: '', due_date: '' })
    setShowInitModal(true)
  }
  function openEditInit(init) {
    setInitParentOkrId(init.okr_id)
    setEditingInit({ ...init, key_result_id: init.key_result_id ?? '', due_date: init.due_date ?? '' })
    setShowInitModal(true)
  }
  async function saveInit() {
    const payload = {
      okr_id: initParentOkrId,
      title: editingInit.title,
      description: editingInit.description || null,
      status: editingInit.status,
      key_result_id: editingInit.key_result_id || null,
      due_date: editingInit.due_date || null,
      owner_id: editingInit.owner_id ?? user?.id,
    }
    if (editingInit.id) {
      await supabase.from('initiatives').update(payload).eq('id', editingInit.id)
    } else {
      await supabase.from('initiatives').insert(payload)
    }
    setShowInitModal(false); load()
  }
  async function deleteInit(id) {
    if (!confirm('Delete this initiative?')) return
    await supabase.from('initiatives').delete().eq('id', id); load()
  }

  // ── Render helpers ──────────────────────────────────────────
  const byQuarter = useMemo(() => {
    const m = { 1: [], 2: [], 3: [], 4: [] }
    okrs.forEach(o => m[o.quarter]?.push(o))
    return m
  }, [okrs])

  const krsFor = (id) => krs.filter(k => k.okr_id === id)
  const initsFor = (id) => inits.filter(i => i.okr_id === id)

  return (
    <>
      <div className="page-header">
        <div>
          <h2>OKRs</h2>
          <div className="sub">Objectives, key results, and the initiatives that drive them — {year}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn primary" onClick={openNewOkr}><Plus size={16} /> New objective</button>
        </div>
      </div>

      {loading ? (
        <div className="empty"><div className="spinner" /></div>
      ) : okrs.length === 0 ? (
        <div className="empty">
          <h3>No OKRs yet for {year}</h3>
          <p>Create your first objective to start tracking progress.</p>
        </div>
      ) : (
        QUARTERS.map(q => byQuarter[q].length > 0 && (
          <div key={q} style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Q{q} {year}
            </h3>
            {byQuarter[q].map(o => {
              const okrKrs = krsFor(o.id)
              const okrInits = initsFor(o.id)
              const avg = okrKrs.length ? okrKrs.reduce((s, k) => s + progressFor(k), 0) / okrKrs.length : 0
              return (
                <div key={o.id} className="okr-card">
                  <div className="okr-head">
                    <div style={{ flex: 1 }}>
                      <h4 className="okr-title">{o.objective}</h4>
                      {o.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>{o.description}</div>}
                      <div className="okr-meta">
                        <span className={'chip ' + (STATUS_TONE[o.status] ?? 'muted')}>{o.status.replace('_', ' ')}</span>
                        <span className="chip muted">{okrKrs.length} KR{okrKrs.length === 1 ? '' : 's'}</span>
                        <span className="chip muted">{okrInits.length} initiative{okrInits.length === 1 ? '' : 's'}</span>
                        <span className="chip muted">{Math.round(avg)}% avg</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="icon-btn" onClick={() => openEditOkr(o)}><Pencil /></button>
                      <button className="icon-btn" onClick={() => deleteOkr(o.id)}><Trash2 /></button>
                    </div>
                  </div>

                  {okrKrs.map(kr => {
                    const pct = progressFor(kr)
                    const tone = pct >= 70 ? 'green' : pct >= 40 ? 'amber' : 'red'
                    return (
                      <div key={kr.id} className="kr-row">
                        <div>
                          <div className="kr-title">{kr.title}</div>
                          <div className="kr-meta">
                            {fmtNum(kr.current_value)} / {fmtNum(kr.target_value)} {kr.unit}
                            {kr.direction === 'min' && <span> · lower is better</span>}
                          </div>
                        </div>
                        <div className={'progress ' + tone}><span style={{ width: pct + '%' }} /></div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{Math.round(pct)}%</span>
                        <div className="kr-actions">
                          <button className="icon-btn" onClick={() => openEditKr(kr)}><Pencil /></button>
                          <button className="icon-btn" onClick={() => deleteKr(kr.id)}><Trash2 /></button>
                        </div>
                      </div>
                    )
                  })}

                  <button className="btn ghost sm" onClick={() => openNewKr(o.id)} style={{ marginTop: 12 }}>
                    <Plus size={14} /> Add key result
                  </button>

                  {/* ── Initiatives section ─────────────────── */}
                  <div style={{
                    marginTop: 18,
                    padding: '14px 0 0',
                    borderTop: '1px solid var(--border)',
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
                      textTransform: 'uppercase', color: 'var(--text-muted)',
                      marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      <Rocket size={13} /> Initiatives
                    </div>

                    {okrInits.length === 0 ? (
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10 }}>
                        No initiatives yet — these are the actual projects/work that move the KRs.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {okrInits.map(init => {
                          const linkedKr = okrKrs.find(k => k.id === init.key_result_id)
                          return (
                            <div key={init.id} style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 130px 140px 80px',
                              gap: 10, alignItems: 'center',
                              padding: '8px 10px',
                              borderRadius: 8,
                              background: 'var(--bg-card-2)',
                            }}>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{init.title}</div>
                                {linkedKr && (
                                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                    → {linkedKr.title}
                                  </div>
                                )}
                              </div>
                              <span className={'chip ' + (INIT_TONE[init.status] ?? 'muted')}>{INIT_LABEL[init.status]}</span>
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {init.due_date ? `Due ${init.due_date}` : 'No due date'}
                              </span>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button className="icon-btn" onClick={() => openEditInit(init)}><Pencil /></button>
                                <button className="icon-btn" onClick={() => deleteInit(init.id)}><Trash2 /></button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    <button className="btn ghost sm" onClick={() => openNewInit(o.id)} style={{ marginTop: 10 }}>
                      <Plus size={14} /> Add initiative
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ))
      )}

      {/* OKR modal */}
      <Modal
        open={showOkrModal}
        onClose={() => setShowOkrModal(false)}
        title={editingOkr?.id ? 'Edit objective' : 'New objective'}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowOkrModal(false)}>Cancel</button>
            <button className="btn primary" onClick={saveOkr} disabled={!editingOkr?.objective}>Save</button>
          </>
        }
      >
        {editingOkr && (
          <>
            <div className="field">
              <label>Objective</label>
              <input value={editingOkr.objective} onChange={(e) => setEditingOkr({ ...editingOkr, objective: e.target.value })} placeholder="e.g. Hit $1M ARR by end of Q4"/>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={3} value={editingOkr.description ?? ''} onChange={(e) => setEditingOkr({ ...editingOkr, description: e.target.value })} placeholder="Why this matters, how we'll know we've won"/>
            </div>
            <div className="row cols-3" style={{ gap: 12 }}>
              <div className="field">
                <label>Year</label>
                <input type="number" value={editingOkr.year} onChange={(e) => setEditingOkr({ ...editingOkr, year: Number(e.target.value) })}/>
              </div>
              <div className="field">
                <label>Quarter</label>
                <select value={editingOkr.quarter} onChange={(e) => setEditingOkr({ ...editingOkr, quarter: Number(e.target.value) })}>
                  {QUARTERS.map(q => <option key={q} value={q}>Q{q}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Status</label>
                <select value={editingOkr.status} onChange={(e) => setEditingOkr({ ...editingOkr, status: e.target.value })}>
                  {OKR_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </Modal>

      {/* KR modal */}
      <Modal
        open={showKrModal}
        onClose={() => setShowKrModal(false)}
        title={editingKr?.id ? 'Edit key result' : 'New key result'}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowKrModal(false)}>Cancel</button>
            <button className="btn primary" onClick={saveKr} disabled={!editingKr?.title}>Save</button>
          </>
        }
      >
        {editingKr && (
          <>
            <div className="field">
              <label>Title</label>
              <input value={editingKr.title} onChange={(e) => setEditingKr({ ...editingKr, title: e.target.value })} placeholder="e.g. Reach 50,000 monthly orders"/>
            </div>
            <div className="row cols-2" style={{ gap: 12 }}>
              <div className="field">
                <label>Unit</label>
                <input value={editingKr.unit ?? ''} onChange={(e) => setEditingKr({ ...editingKr, unit: e.target.value })} placeholder="$, %, #, …"/>
              </div>
              <div className="field">
                <label>Direction</label>
                <select value={editingKr.direction} onChange={(e) => setEditingKr({ ...editingKr, direction: e.target.value })}>
                  <option value="max">Higher is better</option>
                  <option value="min">Lower is better</option>
                </select>
              </div>
            </div>
            <div className="row cols-3" style={{ gap: 12 }}>
              <div className="field"><label>Start</label><input type="number" value={editingKr.start_value} onChange={(e) => setEditingKr({ ...editingKr, start_value: Number(e.target.value) })}/></div>
              <div className="field"><label>Current</label><input type="number" value={editingKr.current_value} onChange={(e) => setEditingKr({ ...editingKr, current_value: Number(e.target.value) })}/></div>
              <div className="field"><label>Target</label><input type="number" value={editingKr.target_value} onChange={(e) => setEditingKr({ ...editingKr, target_value: Number(e.target.value) })}/></div>
            </div>
          </>
        )}
      </Modal>

      {/* Initiative modal */}
      <Modal
        open={showInitModal}
        onClose={() => setShowInitModal(false)}
        title={editingInit?.id ? 'Edit initiative' : 'New initiative'}
        footer={
          <>
            <button className="btn ghost" onClick={() => setShowInitModal(false)}>Cancel</button>
            <button className="btn primary" onClick={saveInit} disabled={!editingInit?.title}>Save</button>
          </>
        }
      >
        {editingInit && (
          <>
            <div className="field">
              <label>Title</label>
              <input value={editingInit.title} onChange={(e) => setEditingInit({ ...editingInit, title: e.target.value })} placeholder="e.g. Launch winter campaign" autoFocus/>
            </div>
            <div className="field">
              <label>Description (optional)</label>
              <textarea rows={3} value={editingInit.description ?? ''} onChange={(e) => setEditingInit({ ...editingInit, description: e.target.value })} placeholder="What this involves, success looks like…"/>
            </div>
            <div className="row cols-3" style={{ gap: 12 }}>
              <div className="field">
                <label>Status</label>
                <select value={editingInit.status} onChange={(e) => setEditingInit({ ...editingInit, status: e.target.value })}>
                  {INIT_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Due date</label>
                <input type="date" value={editingInit.due_date ?? ''} onChange={(e) => setEditingInit({ ...editingInit, due_date: e.target.value })}/>
              </div>
              <div className="field">
                <label>Linked KR (optional)</label>
                <select value={editingInit.key_result_id ?? ''} onChange={(e) => setEditingInit({ ...editingInit, key_result_id: e.target.value })}>
                  <option value="">— none —</option>
                  {krsFor(initParentOkrId).map(kr => (
                    <option key={kr.id} value={kr.id}>{kr.title}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
