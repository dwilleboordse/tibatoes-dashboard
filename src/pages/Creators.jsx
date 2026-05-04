import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { fmtNum } from '../lib/format'

const empty = {
  creator_name: '', audience_size: null,
  youtube_url: '', tiktok_url: '', instagram_url: '',
  content_trends: '', user_comment_notes: '',
}

function shortHost(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

export default function Creators() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('creators').select('*').order('audience_size', { ascending: false, nullsFirst: false })
    setRows(data ?? []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    if (!s) return rows
    return rows.filter(r => [r.creator_name, r.content_trends, r.user_comment_notes].some(v => (v ?? '').toLowerCase().includes(s)))
  }, [rows, search])

  function openNew() { setEditing({ ...empty }); setOpen(true) }
  function openEdit(r) { setEditing(r); setOpen(true) }
  async function save() {
    const { id, created_at, updated_at, owner_id, ...payload } = editing
    payload.audience_size = payload.audience_size === '' || payload.audience_size == null ? null : Number(payload.audience_size)
    if (id) await supabase.from('creators').update(payload).eq('id', id)
    else    await supabase.from('creators').insert(payload)
    setOpen(false); load()
  }
  async function remove() {
    if (!editing?.id) return
    if (!confirm('Delete this creator?')) return
    await supabase.from('creators').delete().eq('id', editing.id)
    setOpen(false); load()
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Creators</h2>
          <div className="sub">Top creator analysis — audience, platforms, and trends.</div>
        </div>
        <button className="btn primary" onClick={openNew}><Plus size={16}/> Add creator</button>
      </div>

      <div className="filters">
        <input placeholder="Search name, trends, notes…" value={search} onChange={(e) => setSearch(e.target.value)}/>
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th>Creator</th>
              <th className="numeric">Audience</th>
              <th>YouTube</th>
              <th>TikTok</th>
              <th>Instagram</th>
              <th>Content trends</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ display: 'inline-block' }}/></td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                {rows.length === 0 ? 'No creators yet. Add your first one.' : 'No creators match your search.'}
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onClick={() => openEdit(r)} style={{ cursor: 'pointer' }}>
                <td style={{ fontWeight: 600 }}>{r.creator_name}</td>
                <td className="numeric">{fmtNum(r.audience_size)}</td>
                {[r.youtube_url, r.tiktok_url, r.instagram_url].map((url, i) => (
                  <td key={i}>
                    {url ? (
                      <a
                        href={url} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                      >
                        {shortHost(url)} <ExternalLink size={12}/>
                      </a>
                    ) : '—'}
                  </td>
                ))}
                <td style={{ maxWidth: 240, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {r.content_trends ? (r.content_trends.length > 80 ? r.content_trends.slice(0, 80) + '…' : r.content_trends) : '—'}
                </td>
                <td style={{ maxWidth: 240, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {r.user_comment_notes ? (r.user_comment_notes.length > 80 ? r.user_comment_notes.slice(0, 80) + '…' : r.user_comment_notes) : '—'}
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
        title={editing?.id ? 'Edit creator' : 'New creator'}
        footer={
          <>
            {editing?.id && <button className="btn" onClick={remove}><Trash2 size={14}/> Delete</button>}
            <div style={{ flex: 1 }}/>
            <button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={save} disabled={!editing?.creator_name}>Save</button>
          </>
        }
      >
        {editing && (
          <>
            <div className="row cols-2" style={{ gap: 12 }}>
              <div className="field">
                <label>Creator name</label>
                <input value={editing.creator_name} onChange={(e) => setEditing({ ...editing, creator_name: e.target.value })} autoFocus/>
              </div>
              <div className="field">
                <label>Audience size</label>
                <input type="number" value={editing.audience_size ?? ''} onChange={(e) => setEditing({ ...editing, audience_size: e.target.value })}/>
              </div>
            </div>
            <div className="field"><label>YouTube URL</label><input value={editing.youtube_url ?? ''} onChange={(e) => setEditing({ ...editing, youtube_url: e.target.value })} placeholder="https://youtube.com/@…"/></div>
            <div className="field"><label>TikTok URL</label><input value={editing.tiktok_url ?? ''} onChange={(e) => setEditing({ ...editing, tiktok_url: e.target.value })} placeholder="https://tiktok.com/@…"/></div>
            <div className="field"><label>Instagram URL</label><input value={editing.instagram_url ?? ''} onChange={(e) => setEditing({ ...editing, instagram_url: e.target.value })} placeholder="https://instagram.com/…"/></div>
            <div className="field">
              <label>High-performing content trends</label>
              <textarea rows={3} value={editing.content_trends ?? ''} onChange={(e) => setEditing({ ...editing, content_trends: e.target.value })} placeholder="What types of content perform best for them?"/>
            </div>
            <div className="field">
              <label>User comment notes</label>
              <textarea rows={3} value={editing.user_comment_notes ?? ''} onChange={(e) => setEditing({ ...editing, user_comment_notes: e.target.value })} placeholder="Patterns from comments — pain points, desires, language…"/>
            </div>
          </>
        )}
      </Modal>
    </>
  )
}
