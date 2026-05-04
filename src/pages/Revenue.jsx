import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { supabase } from '../lib/supabase'
import { fmtMoney, fmtPct } from '../lib/format'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function emptyMonth(year, month) {
  return {
    year, month,
    actual_revenue: null, actual_spend: null,
    prior_year_revenue: null, prior_year_spend: null,
    key_events: '', promotions: '', winning_ads: '', product_launches: '',
  }
}

const NUMERIC_FIELDS = new Set(['actual_revenue', 'actual_spend', 'prior_year_revenue', 'prior_year_spend'])
const NOTE_FIELDS = new Set(['key_events', 'promotions', 'winning_ads', 'product_launches'])

export default function Revenue() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [settings, setSettings] = useState(null)
  const [data, setData] = useState([])
  const [draft, setDraft] = useState({})
  const [draftSettings, setDraftSettings] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data: s }, { data: rows }] = await Promise.all([
      supabase.from('revenue_settings').select('*').eq('year', year).maybeSingle(),
      supabase.from('revenue_months').select('*').eq('year', year).order('month'),
    ])
    setSettings(s ?? { year, yearly_revenue_target: 0, target_mer: 1.8, gross_margin_pct: 0.7 })
    const byMonth = {}
    ;(rows ?? []).forEach(r => { byMonth[r.month] = r })
    setData(Array.from({ length: 12 }, (_, i) => byMonth[i + 1] ?? emptyMonth(year, i + 1)))
    setDraft({}); setDraftSettings(null); setLoading(false)
  }
  useEffect(() => { load() }, [year])

  // --- Cell helpers ---------------------------------------------
  function setCell(month, field, value) {
    setDraft(d => ({ ...d, [`${month}:${field}`]: value }))
  }
  function getCell(month, field) {
    const k = `${month}:${field}`
    if (k in draft) return draft[k] ?? ''
    const row = data.find(r => r.month === month) ?? {}
    return row[field] ?? ''
  }
  function getCellNumber(month, field) {
    const v = getCell(month, field)
    if (v === '' || v == null) return null
    return Number(v)
  }

  // --- Computed monthly numbers ---------------------------------
  const computed = useMemo(() => {
    if (!settings) return []
    const yearlyTarget = Number(draftSettings?.yearly_revenue_target ?? settings.yearly_revenue_target) || 0
    const targetMer    = Number(draftSettings?.target_mer ?? settings.target_mer) || 1.8
    const margin       = Number(draftSettings?.gross_margin_pct ?? settings.gross_margin_pct) || 0.7

    // Prior year totals (for seasonality % calc)
    const priorRevs = Array.from({ length: 12 }, (_, i) => getCellNumber(i + 1, 'prior_year_revenue') ?? 0)
    const priorSpends = Array.from({ length: 12 }, (_, i) => getCellNumber(i + 1, 'prior_year_spend') ?? 0)
    const priorTotal = priorRevs.reduce((s, v) => s + v, 0)

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const days = daysInMonth(year, month)
      const priorRev = priorRevs[i]
      const priorSpend = priorSpends[i]
      const priorPct = priorTotal > 0 ? priorRev / priorTotal : 1 / 12   // even split fallback
      const priorMer = priorSpend > 0 ? priorRev / priorSpend : null
      const priorProfit = priorRev * margin - priorSpend

      const targetRev = yearlyTarget * priorPct
      const targetSpend = targetMer > 0 ? targetRev / targetMer : 0
      const targetGross = targetRev * margin - targetSpend

      const actualRev = getCellNumber(month, 'actual_revenue')
      const actualSpend = getCellNumber(month, 'actual_spend')
      const actualMer = actualRev != null && actualSpend > 0 ? actualRev / actualSpend : null
      const actualGross = actualRev != null && actualSpend != null ? actualRev * margin - actualSpend : null

      const salesGrowth = priorRev > 0 && actualRev != null ? (actualRev - priorRev) / priorRev : null
      const spendGrowth = priorSpend > 0 && actualSpend != null ? (actualSpend - priorSpend) / priorSpend : null
      const merGrowth   = priorMer != null && actualMer != null ? (actualMer - priorMer) / priorMer : null
      const profitGrowth = priorProfit !== 0 && actualGross != null ? (actualGross - priorProfit) / Math.abs(priorProfit) : null

      return {
        month, days,
        priorPct, priorRev, priorSpend, priorMer, priorProfit,
        targetRev, targetSpend, targetGross,
        targetDailyRev: targetRev / days,
        targetDailySpend: targetSpend / days,
        targetGrossPct: targetRev > 0 ? targetGross / targetRev : 0,
        actualRev, actualSpend, actualMer, actualGross,
        salesGrowth, spendGrowth, merGrowth, profitGrowth,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, draft, settings, draftSettings, year])

  const totals = useMemo(() => {
    const sum = (key) => computed.reduce((s, m) => s + (m[key] || 0), 0)
    return {
      targetRev: sum('targetRev'),
      targetSpend: sum('targetSpend'),
      targetGross: sum('targetGross'),
      actualRev: computed.reduce((s, m) => s + (m.actualRev || 0), 0),
      actualSpend: computed.reduce((s, m) => s + (m.actualSpend || 0), 0),
      priorRev: sum('priorRev'),
      priorSpend: sum('priorSpend'),
    }
  }, [computed])

  const dirty = Object.keys(draft).length > 0 || draftSettings != null

  async function saveAll() {
    setSaving(true); setSaveMsg(null)
    try {
      // Save settings if dirty
      if (draftSettings) {
        const payload = {
          year,
          yearly_revenue_target: Number(draftSettings.yearly_revenue_target ?? settings.yearly_revenue_target) || 0,
          target_mer:            Number(draftSettings.target_mer ?? settings.target_mer) || 1.8,
          gross_margin_pct:      Number(draftSettings.gross_margin_pct ?? settings.gross_margin_pct) || 0.7,
        }
        const { error } = await supabase.from('revenue_settings').upsert(payload, { onConflict: 'year' })
        if (error) throw error
      }
      // Save month edits
      if (Object.keys(draft).length > 0) {
        const byMonth = {}
        Object.entries(draft).forEach(([k, v]) => {
          const [m, f] = k.split(':')
          const month = Number(m)
          byMonth[month] = byMonth[month] || { ...(data.find(r => r.month === month) ?? emptyMonth(year, month)) }
          if (NOTE_FIELDS.has(f)) byMonth[month][f] = v === '' ? null : v
          else if (NUMERIC_FIELDS.has(f)) byMonth[month][f] = (v === '' || v == null) ? null : Number(v)
          else byMonth[month][f] = v
        })
        const upserts = Object.values(byMonth).map(({ id, created_at, updated_at, ...rest }) => ({ ...rest, year }))
        const { error } = await supabase.from('revenue_months').upsert(upserts, { onConflict: 'year,month' })
        if (error) throw error
      }
      setSaveMsg({ ok: true, text: 'Saved' })
      await load()
    } catch (e) {
      console.error('[revenue save error]', e)
      setSaveMsg({ ok: false, text: e.message ?? String(e) })
    } finally {
      setSaving(false)
    }
  }

  const chartData = computed.map(m => ({
    month: MONTHS[m.month - 1],
    target: Math.round(m.targetRev),
    actual: Math.round(m.actualRev || 0),
  }))

  if (loading) return <div className="empty"><div className="spinner" style={{ display: 'inline-block' }}/></div>

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Revenue Forecast</h2>
          <div className="sub">Set your goal, type actuals — targets calculate automatically.</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn" disabled={!dirty} onClick={() => { setDraft({}); setDraftSettings(null) }}>Discard</button>
          <button className="btn primary" disabled={!dirty || saving} onClick={saveAll}>
            {saving ? 'Saving…' : `Save${dirty ? ` (${Object.keys(draft).length + (draftSettings ? 1 : 0)})` : ''}`}
          </button>
        </div>
      </div>

      {saveMsg && (
        <div className={'pill ' + (saveMsg.ok ? 'green' : 'red')} style={{ marginBottom: 16, padding: '8px 14px', fontSize: 13 }}>
          {saveMsg.text}
        </div>
      )}

      {/* ── Year settings ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title">Year settings</h3>
        <div className="row cols-3" style={{ gap: 14 }}>
          <div className="field">
            <label>Yearly revenue goal ($)</label>
            <input
              type="number"
              value={(draftSettings?.yearly_revenue_target ?? settings?.yearly_revenue_target ?? '') + ''}
              onChange={(e) => setDraftSettings(d => ({ ...(d ?? {}), yearly_revenue_target: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Target MER (revenue ÷ spend)</label>
            <input
              type="number" step="0.01"
              value={(draftSettings?.target_mer ?? settings?.target_mer ?? '') + ''}
              onChange={(e) => setDraftSettings(d => ({ ...(d ?? {}), target_mer: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Gross margin (0–1)</label>
            <input
              type="number" step="0.01" min="0" max="1"
              value={(draftSettings?.gross_margin_pct ?? settings?.gross_margin_pct ?? '') + ''}
              onChange={(e) => setDraftSettings(d => ({ ...(d ?? {}), gross_margin_pct: e.target.value }))}
            />
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Tip: gross margin is your contribution margin after COGS but before ad spend. 0.7 = 70%.
        </div>
      </div>

      {/* ── Stat overview ────────────────────────────────────────── */}
      <div className="stat-grid">
        <div className="stat active">
          <span className="stat-label">Revenue YTD</span>
          <span className="stat-value">{fmtMoney(totals.actualRev)}</span>
          <span className="stat-sub">target {fmtMoney(totals.targetRev)} · {totals.targetRev ? ((totals.actualRev / totals.targetRev) * 100).toFixed(1) : 0}%</span>
        </div>
        <div className="stat">
          <span className="stat-label">Spend YTD</span>
          <span className="stat-value">{fmtMoney(totals.actualSpend)}</span>
          <span className="stat-sub">target {fmtMoney(totals.targetSpend)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Actual MER YTD</span>
          <span className="stat-value">{totals.actualSpend > 0 ? (totals.actualRev / totals.actualSpend).toFixed(2) : '—'}</span>
          <span className="stat-sub">target {Number(draftSettings?.target_mer ?? settings?.target_mer ?? 0).toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">YoY revenue growth</span>
          <span className="stat-value">{totals.priorRev > 0 ? (((totals.actualRev - totals.priorRev) / totals.priorRev) * 100).toFixed(1) + '%' : '—'}</span>
          <span className="stat-sub">vs. {fmtMoney(totals.priorRev)} prior year</span>
        </div>
      </div>

      {/* ── Chart ────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title">Target vs. actual revenue</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#1e2236" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="month" stroke="#5b6079" fontSize={12}/>
              <YAxis stroke="#5b6079" fontSize={12} tickFormatter={(v) => v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`}/>
              <Tooltip
                contentStyle={{ background: '#11131f', border: '1px solid #1e2236', borderRadius: 8, fontSize: 12 }}
                formatter={(v) => fmtMoney(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }}/>
              <Bar dataKey="target" fill="#5b8cff" radius={[6, 6, 0, 0]} name="🎯 Target"/>
              <Bar dataKey="actual" fill="#22c55e" radius={[6, 6, 0, 0]} name="📊 Actual"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Big grid ─────────────────────────────────────────────── */}
      <div className="table-wrap" style={{ overflowX: 'auto' }}>
        <table style={{ minWidth: 1200 }}>
          <thead>
            <tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--bg-card-2)', minWidth: 220 }}>Metric</th>
              {MONTHS.map(m => <th key={m} className="numeric">{m}</th>)}
              <th className="numeric">Total</th>
            </tr>
          </thead>
          <tbody>
            <ComputedRow label="🎯 % of yearly revenue"  unit="pct"   values={computed.map(m => m.priorPct)}        total={1}/>
            <ComputedRow label="🎯 Monthly revenue"      unit="money" values={computed.map(m => m.targetRev)}       total={totals.targetRev}/>
            <ComputedRow label="🎯 Daily revenue"        unit="money" values={computed.map(m => m.targetDailyRev)} muted/>
            <EditRow label="📊 Actual revenue"         field="actual_revenue" months={data} getCell={getCell} setCell={setCell} totalFn={() => totals.actualRev} fmt="money"/>

            <ComputedRow label="🎯 Monthly spend"        unit="money" values={computed.map(m => m.targetSpend)}     total={totals.targetSpend}/>
            <ComputedRow label="🎯 Daily spend"          unit="money" values={computed.map(m => m.targetDailySpend)} muted/>
            <EditRow label="📊 Actual spend"           field="actual_spend"   months={data} getCell={getCell} setCell={setCell} totalFn={() => totals.actualSpend} fmt="money"/>

            <ComputedRow label="🎯 Target MER" values={computed.map(() => Number(draftSettings?.target_mer ?? settings?.target_mer ?? 1.8))} unit="num" muted total={Number(draftSettings?.target_mer ?? settings?.target_mer ?? 1.8)}/>
            <ComputedRow label="📊 Actual MER" values={computed.map(m => m.actualMer)} unit="num" total={totals.actualSpend > 0 ? totals.actualRev / totals.actualSpend : null}/>

            <ComputedRow label="🎯 Gross profit" unit="money" values={computed.map(m => m.targetGross)} total={totals.targetGross}/>
            <ComputedRow label="📊 Gross profit" unit="money" values={computed.map(m => m.actualGross)} total={computed.reduce((s, m) => s + (m.actualGross || 0), 0)}/>

            <SectionRow label="Prior year reference"/>
            <EditRow label="📅 Prior year revenue" field="prior_year_revenue" months={data} getCell={getCell} setCell={setCell} totalFn={() => totals.priorRev} fmt="money"/>
            <EditRow label="📅 Prior year spend"   field="prior_year_spend"   months={data} getCell={getCell} setCell={setCell} totalFn={() => totals.priorSpend} fmt="money"/>

            <SectionRow label="Year-over-year growth"/>
            <ComputedRow label="📈 Sales growth"  unit="pct" values={computed.map(m => m.salesGrowth)}/>
            <ComputedRow label="📈 Spend growth"  unit="pct" values={computed.map(m => m.spendGrowth)}/>
            <ComputedRow label="📈 MER growth"    unit="pct" values={computed.map(m => m.merGrowth)}/>
            <ComputedRow label="📈 Profit growth" unit="pct" values={computed.map(m => m.profitGrowth)}/>

            <SectionRow label="Notes"/>
            <NoteRow label="🔑 Key events"       field="key_events"       months={data} getCell={getCell} setCell={setCell}/>
            <NoteRow label="🏷️ Promotions"      field="promotions"        months={data} getCell={getCell} setCell={setCell}/>
            <NoteRow label="🚀 Winning ads"     field="winning_ads"       months={data} getCell={getCell} setCell={setCell}/>
            <NoteRow label="📦 Product launches" field="product_launches" months={data} getCell={getCell} setCell={setCell}/>
          </tbody>
        </table>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────
function fmtBy(unit, v) {
  if (v == null || isNaN(v)) return '—'
  if (unit === 'money') return fmtMoney(v)
  if (unit === 'pct')   return (v * 100).toFixed(1) + '%'
  if (unit === 'num')   return Number(v).toFixed(2)
  return String(v)
}

function ComputedRow({ label, values, total, unit = 'money', muted }) {
  return (
    <tr>
      <td className="label-cell" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', color: muted ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{label}</td>
      {values.map((v, i) => (
        <td key={i} className="numeric" style={{ color: muted ? 'var(--text-muted)' : 'var(--text-primary)' }}>{fmtBy(unit, v)}</td>
      ))}
      <td className="numeric" style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: 600 }}>
        {total === undefined ? '' : fmtBy(unit, total)}
      </td>
    </tr>
  )
}

function EditRow({ label, field, months, getCell, setCell, totalFn, fmt }) {
  return (
    <tr>
      <td className="label-cell" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)' }}>{label}</td>
      {months.map(m => (
        <td key={m.month} className="numeric" style={{ padding: 4 }}>
          <input
            className="cell-edit"
            style={{ textAlign: 'right' }}
            type="number"
            value={getCell(m.month, field)}
            onChange={(e) => setCell(m.month, field, e.target.value)}
            placeholder="—"
          />
        </td>
      ))}
      <td className="numeric" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
        {totalFn ? (fmt === 'money' ? fmtMoney(totalFn()) : totalFn()) : ''}
      </td>
    </tr>
  )
}

function NoteRow({ label, field, months, getCell, setCell }) {
  return (
    <tr>
      <td className="label-cell" style={{ position: 'sticky', left: 0, background: 'var(--bg-card)' }}>{label}</td>
      {months.map(m => (
        <td key={m.month} style={{ padding: 4, minWidth: 130 }}>
          <input
            className="cell-edit"
            value={getCell(m.month, field)}
            onChange={(e) => setCell(m.month, field, e.target.value)}
            placeholder="—"
          />
        </td>
      ))}
      <td/>
    </tr>
  )
}

function SectionRow({ label }) {
  return (
    <tr>
      <td colSpan={14} style={{
        position: 'sticky', left: 0,
        background: 'var(--bg-card-2)',
        color: 'var(--text-muted)',
        fontSize: 11, textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 600,
        padding: '8px 14px',
      }}>{label}</td>
    </tr>
  )
}
