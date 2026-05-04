export const fmtMoney = (n) =>
  n == null || n === '' ? '—' : '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

export const fmtPct = (n) =>
  n == null || n === '' ? '—' : Number(n).toFixed(1) + '%'

export const fmtNum = (n) =>
  n == null || n === '' ? '—' : Number(n).toLocaleString('en-US')

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n))

export function progressFor(kr) {
  const { start_value = 0, current_value = 0, target_value, direction = 'max' } = kr
  if (target_value == null || target_value === start_value) return 0
  if (direction === 'max') {
    return clamp(((current_value - start_value) / (target_value - start_value)) * 100, 0, 100)
  }
  // min: lower is better
  return clamp(((start_value - current_value) / (start_value - target_value)) * 100, 0, 100)
}

export const STATUS_TONE = {
  on_track: 'green', achieved: 'green',
  at_risk: 'amber',
  off_track: 'red', missed: 'red',
}
