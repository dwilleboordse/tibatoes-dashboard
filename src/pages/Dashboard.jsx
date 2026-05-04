import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtPct, progressFor, STATUS_TONE } from '../lib/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function Dashboard() {
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1
  const quarter = Math.ceil(month / 3)

  const [okrs, setOkrs]       = useState([])
  const [krs, setKrs]         = useState([])
  const [creative, setCreative] = useState([])
  const [creators, setCreators] = useState([])
  const [revenue, setRevenue] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    let cancel = false
    setLoading(true); setLoadError(null)
    Promise.all([
      supabase.from('okrs').select('*').eq('year', year).order('quarter'),
      supabase.from('key_results').select('*'),
      supabase.from('creative_roadmap').select('id, status, test_result, spend'),
      supabase.from('creators').select('id'),
      supabase.from('revenue_months').select('*').eq('year', year).order('month'),
    ]).then(([o, k, cr, cw, rv]) => {
      if (cancel) return
      const firstErr = [o, k, cr, cw, rv].find(r => r.error)?.error
      if (firstErr) {
        setLoadError(firstErr.message)
      } else {
        setOkrs(o.data ?? [])
        setKrs(k.data ?? [])
        setCreative(cr.data ?? [])
        setCreators(cw.data ?? [])
        setRevenue(rv.data ?? [])
      }
    }).catch((e) => {
      if (!cancel) setLoadError(e.message ?? String(e))
    }).finally(() => {
      if (!cancel) setLoading(false)
    })
    return () => { cancel = true }
  }, [year])

  const stats = useMemo(() => {
    const winners = creative.filter(r => r.test_result === 'winner').length
    const decided = creative.filter(r => r.test_result === 'winner' || r.test_result === 'loser').length
    const hitRate = decided ? (winners / decided) * 100 : 0

    const ytdActual = revenue.reduce((s, r) => s + (Number(r.actual_revenue) || 0), 0)
    const ytdTarget = revenue.reduce((s, r) => s + (Number(r.target_revenue) || 0), 0)
    const thisMonth = revenue.find(r => r.month === month) ?? {}

    const openOkrs = okrs.filter(o => !['achieved', 'missed'].includes(o.status)).length

    return {
      hitRate, winners, decided,
      ytdActual, ytdTarget,
      mtdActual: Number(thisMonth.actual_revenue) || 0,
      mtdTarget: Number(thisMonth.target_revenue) || 0,
      openOkrs, totalCreators: creators.length,
    }
  }, [okrs, creative, revenue, creators, month])

  const chart = useMemo(() => {
    const m = {}
    revenue.forEach(r => m[r.month] = r)
    return Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i],
      target: Number(m[i + 1]?.target_revenue) || 0,
      actual: Number(m[i + 1]?.actual_revenue) || 0,
    }))
  }, [revenue])

  const currentQuarterOkrs = okrs.filter(o => o.quarter === quarter)
  const krsByOkr = useMemo(() => {
    const m = {}
    krs.forEach(k => (m[k.okr_id] = m[k.okr_id] || []).push(k))
    return m
  }, [krs])

  if (loading) return <div className="empty"><div className="spinner" style={{ display: 'inline-block' }}/></div>
  if (loadError) return (
    <div className="empty">
      <h3>Couldn't load dashboard data</h3>
      <p style={{ marginBottom: 14 }}>{loadError}</p>
      <button className="btn primary" onClick={() => window.location.reload()}>Try again</button>
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Welcome back to TibaToes</h2>
          <div className="sub">Q{quarter} {year} snapshot.</div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat active">
          <span className="stat-label">Revenue YTD</span>
          <span className="stat-value">{fmtMoney(stats.ytdActual)}</span>
          <span className="stat-sub">{stats.ytdTarget > 0 ? `${((stats.ytdActual / stats.ytdTarget) * 100).toFixed(1)}% of ${fmtMoney(stats.ytdTarget)} target` : 'set target in Revenue page'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">This month</span>
          <span className="stat-value green">{fmtMoney(stats.mtdActual)}</span>
          <span className="stat-sub">target {fmtMoney(stats.mtdTarget)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Open OKRs</span>
          <span className="stat-value">{stats.openOkrs}</span>
          <span className="stat-sub">{okrs.length} total this year</span>
        </div>
        <div className="stat">
          <span className="stat-label">Creative hit rate</span>
          <span className="stat-value">{fmtPct(stats.hitRate)}</span>
          <span className="stat-sub">{stats.winners}W / {stats.decided} decided</span>
        </div>
        <div className="stat">
          <span className="stat-label">Creators tracked</span>
          <span className="stat-value">{stats.totalCreators}</span>
        </div>
      </div>

      <div className="row cols-2">
        <div className="card">
          <h3 className="card-title">Q{quarter} OKR progress</h3>
          {currentQuarterOkrs.length === 0 ? (
            <div className="empty"><h3>No Q{quarter} OKRs</h3><p>Add objectives in the <Link to="/okrs" style={{ color: 'var(--accent)' }}>OKRs page</Link>.</p></div>
          ) : currentQuarterOkrs.map(o => {
            const okrKrs = krsByOkr[o.id] ?? []
            const avg = okrKrs.length ? okrKrs.reduce((s, k) => s + progressFor(k), 0) / okrKrs.length : 0
            const tone = avg >= 70 ? 'green' : avg >= 40 ? 'amber' : 'red'
            return (
              <div key={o.id} style={{ padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontWeight: 500, fontSize: 13.5 }}>{o.objective}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={'chip ' + (STATUS_TONE[o.status] ?? 'muted')}>{o.status.replace('_',' ')}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{Math.round(avg)}%</span>
                  </div>
                </div>
                <div className={'progress ' + tone}><span style={{ width: avg + '%' }}/></div>
              </div>
            )
          })}
        </div>

        <div className="card">
          <h3 className="card-title">Revenue — target vs. actual ({year})</h3>
          {revenue.length === 0 ? (
            <div className="empty">
              <h3>No forecast yet</h3>
              <p>Seed in the <Link to="/revenue" style={{ color: 'var(--accent)' }}>Revenue page</Link>.</p>
            </div>
          ) : (
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#1e2236" strokeDasharray="3 3" vertical={false}/>
                  <XAxis dataKey="month" stroke="#5b6079" fontSize={12}/>
                  <YAxis stroke="#5b6079" fontSize={12} tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`}/>
                  <Tooltip
                    contentStyle={{ background: '#11131f', border: '1px solid #1e2236', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => fmtMoney(v)}
                  />
                  <Bar dataKey="target" fill="#5b8cff" radius={[6, 6, 0, 0]}/>
                  <Bar dataKey="actual" fill="#22c55e" radius={[6, 6, 0, 0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
