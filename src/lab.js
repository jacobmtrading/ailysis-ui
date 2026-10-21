import { useEffect, useState } from 'react'

// The Lab's subject — the portfolio (or single stock) the user enters once and
// every tool runs on. Kept in App so the insight views can add proposals to it,
// and remembered in this browser so it survives a reload.
const KEY = 'ailysis_lab'
const EMPTY_ROW = { ticker: '', weightPct: '' }

export const freshLab = () => ({
  mode: 'portfolio',
  rows: [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }],
  stock: null,
})

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY))
    if (!saved) return freshLab()
    const rows = (saved.rows || []).filter((r) => r.ticker)
    while (rows.length < 3) rows.push({ ...EMPTY_ROW })
    return { mode: saved.mode === 'stock' ? 'stock' : 'portfolio', rows, stock: saved.stock || null }
  } catch {
    return freshLab()
  }
}

export function useLab() {
  const [lab, setLab] = useState(load)
  useEffect(() => {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ mode: lab.mode, stock: lab.stock, rows: lab.rows.filter((r) => r.ticker).map(({ ticker, weightPct }) => ({ ticker, weightPct, picked: true })) })
      )
    } catch {
      /* storage blocked — the Lab still works for this visit */
    }
  }, [lab])
  return [lab, setLab]
}

export const filledRows = (lab) =>
  lab.rows.filter((r) => r.ticker && r.weightPct).map((r) => ({ ticker: r.ticker, weightPct: +r.weightPct }))

// A proposal accepted from the risk map joins the portfolio at a starter weight.
export const STARTER_WEIGHT = 5
export function addPosition(lab, ticker) {
  if (lab.rows.some((r) => r.ticker === ticker)) return lab
  const rows = lab.rows.filter((r) => r.ticker || r.weightPct)
  return { ...lab, mode: 'portfolio', rows: [...rows, { ticker, weightPct: String(STARTER_WEIGHT), picked: true }] }
}
export function removePosition(lab, ticker) {
  return { ...lab, rows: lab.rows.filter((r) => r.ticker !== ticker) }
}
