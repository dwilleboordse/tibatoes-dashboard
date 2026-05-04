import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { fmtMoney } from '../lib/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const ROWS = [
  { key: 'target_revenue',     label: '🎯 Revenue target',  fmt: 'money' },
  { key: 'actual_revenue',     label: '📊 Revenue actual',  fmt: 'money' },
  { key: 'target_spend',       label: '🎯 Spend target',    fmt: 'money' },
  { key: 'actual_spend',       label: '📊 Spend actual',    fmt: 'money' },
  { key: 'target_mer',         label: '🎯 MER target',      fmt: 'num'   },
  { key: 'actual_mer',         label: '📊 MER actual',      fmt: 'num'   },
  { key: 'target_gross_profit',label: '🎯 Gross profit',    fmt: 'money' },
  { key: 'actual_gross_profit',label: '📊 Gross actual',    fmt: 'money' },
  { key: 'prior_year_revenue', label: '📅 Prior-year rev',  fmt: 'money' },
]

const NOTES = [
  { key: 'key_events',       label: '🔑 Key events' },
  { key: 'promotions',       label: '🏷️ Promotions' },
  { key: 'winning_ads',      label: '🚀 Winning ads' },
  { key: 'product_launches', label: '📦 Product launches' },
]

function emptyMonth(year, month) {
  return {
    year, month,
    target_revenue: null, actual_revenue: null,
    target_spend: null, actual_spend: null,
    target_mer: null, actual_mer: null,
    target_gross_profit: null, actual_gross_profit: null,
    prior_year_revenue: null,
    key_events: '', promotions: '', winning_ads: '', product_launches: '',
  }
}

export default function Revenue() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState([])
  const [draft, setDraft] = useState({}) // pending edits keyed by `${month}:${field}`
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data: rows } = await supabase
      .from('revenue_months')
      .select('*')
      .eq('year', year)
      .order('month')
    const byMonth = {}
    ;(rows ?? []).forEach(r => { byMonth[r.month] = r })
    const full = Array.from({ length: 12 }, (_, i) => byMonth[i + 1] ?? emptyMonth(year, i + 1))
    setData(full); setDraft({})
  }
  useEffect(() => { load() }, [year])

  function setCell(month, field, value) {
    setDraft(d => ({ ...d, [`${month}:${field}`]: value }))
  }
  function getCell(month, field) {
    const k = `${month}:${field}`
    if (k in draft) return draft[k] ?? ''
    const row = data.find(r => r.month === month) ?? {}
    return row[field] ?? ''
  }

  async function saveAll() {
    if (Object.keys(draft).length === 0) return
    setSaving(true)
    const byMonth = {}
    Object.entries(draft).forEach(([k, v]) => {
      const [m, f] = k.split(':')
      const month = Number(m)
      byMonth[month] = byMonth[month] || { ...(data.find(r => r.month === month) ?? emptyMonth(year, month)) }
      byMonth[month][f] = (v === '' || v == null) ? null : (typeof data[0][f] === 'string' || ['key_events','promotions','winning_ads','product_launches'].includes(f) ? v : Number(v))
    })
    const upserts = Object.values(byMonth).map(({ id, created_at, updated_at, ...rest }) => ({ ...rest, year }))
    const { error } = await supabase.from('revenue_months').upsert(upserts, { onConflict: 'year,month' })
    if (error) console.error(error)
    setSaving(false); load()
  }

  const chartData = useMemo(() =>
    data.map(d => ({
      month: MONTHS[d.month - 1],
      target: Number(d.target_revenue) || 0,
      actual: Number(d.actual_revenue) || 0,
    })), [data])

  const totals = useMemo(() => {
    const t = data.reduce((s, d) => s + (Number(d.target_revenue) || 0), 0)
    const a = data.reduce((s, d) => s + (Number(d.actual_revenue) || 0), 0)
    const ts = data.reduce((s, d) => s + (Number(d.target_spend) || 0), 0)
    const as_ = data.reduce((s, d) => s + (Number(d.actual_spend) || 0), 0)
    return { targetRev: t, actualRev: a, targetSpend: ts, actualSpend: as_, pct: t ? (a / t) * 100 : 0 }
  }, [data])

  const dirty = Object.keys(draft).length > 0

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Revenue Forecast</h2>
          <div className="sub">Monthly targets vs. actuals — {year}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn" disabled={!dirty} onClick={() => setDraft({})}>Discard</button>
          <button className="btn primary" disabled={!dirty || saving} onClick={saveAll}>
            {saving ? 'Saving…' : `Save${dirty ? ` (${Object.keys(draft).length})` : ''}`}
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat active">
          <span className="stat-label">Revenue target</span>
          <span className="stat-value">{fmtMoney(totals.targetRev)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Revenue actual</span>
          <span className="stat-value green">{fmtMoney(totals.actualRev)}</span>
          <span className="stat-sub">{totals.pct.toFixed(1)}% of target</span>
        </div>
        <div className="stat">
          <span className="stat-label">Spend target</span>
          <span className="stat-value">{fmtMoney(totals.targetSpend)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Spend actual</span>
          <span className="stat-value">{fmtMoney(totals.actualSpend)}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title">Target vs. actual revenue</h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
      </div>

      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card-2)' }}>Metric</th>
              {MONTHS.map(m => <th key={m} className="numeric">{m}</th>)}
              <th className="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => {
              const total = data.reduce((s, d, i) => {
                const v = (`${i+1}:${r.key}` in draft) ? draft[`${i+1}:${r.key}`] : d[r.key]
                return s + (Number(v) || 0)
              }, 0)
              return (
                <tr key={r.key}>
                  <td className="label-cell" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)' }}>{r.label}</td>
                  {data.map(d => (
                    <td key={d.month} className="numeric" style={{ padding: 4 }}>
                      <input
                        className="cell-edit"
                        style={{ textAlign: 'right' }}
                        type="number"
                        value={getCell(d.month, r.key)}
                        onChange={(e) => setCell(d.month, r.key, e.target.value)}
                        placeholder="—"
                      />
                    </td>
                  ))}
                  <td className="numeric" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {r.fmt === 'money' ? fmtMoney(total) : total.toLocaleString()}
                  </td>
                </tr>
              )
            })}
            {NOTES.map(r => (
              <tr key={r.key}>
                <td className="label-cell" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)' }}>{r.label}</td>
                {data.map(d => (
                  <td key={d.month} style={{ padding: 4, minWidth: 120 }}>
                    <input
                      className="cell-edit"
                      value={getCell(d.month, r.key)}
                      onChange={(e) => setCell(d.month, r.key, e.target.value)}
                      placeholder="—"
                    />
                  </td>
                ))}
                <td/>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
