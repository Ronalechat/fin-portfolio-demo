import type { Trade } from '../../data/types'
import type { SortState, SparklinePoint } from './table.types'

const W = 60
const H = 20
const PAD = 2

export const sortTrades = (trades: Trade[], sort: SortState | null, avgCost: number): Trade[] => {
  if (!sort) return trades
  const sorted = [...trades].sort((a, b) => {
    switch (sort.key) {
      case 'date':  return a.date.localeCompare(b.date)
      case 'qty':   return a.quantity - b.quantity
      case 'price': return a.price - b.price
      case 'value': return (a.price * a.quantity) - (b.price * b.quantity)
      case 'delta': {
        const da = (a.price - avgCost) / avgCost
        const db = (b.price - avgCost) / avgCost
        return da - db
      }
    }
  })
  return sort.desc ? sorted.reverse() : sorted
}

export const buildSparklinePoints = (trades: Trade[]): SparklinePoint[] => {
  if (trades.length < 2) return []
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  const base = sorted[0]!.price
  let cum = 0
  const pts = sorted.map((t, i) => {
    cum += (t.price - base) * t.quantity * (t.side === 'BUY' ? 1 : -1)
    return { i, pnl: cum }
  })
  const minP = Math.min(...pts.map(p => p.pnl))
  const maxP = Math.max(...pts.map(p => p.pnl))
  const span = maxP - minP || 1
  const xStep = (W - PAD * 2) / (pts.length - 1)
  return pts.map(({ i, pnl }) => ({
    x: PAD + i * xStep,
    y: PAD + (1 - (pnl - minP) / span) * (H - PAD * 2),
  }))
}

export const polylinePath = (pts: SparklinePoint[]): string => {
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

export const areaPath = (pts: SparklinePoint[]): string => {
  if (pts.length === 0) return ''
  const line = polylinePath(pts)
  const last  = pts[pts.length - 1]!
  const first = pts[0]!
  return `${line} L${last.x.toFixed(1)},${(H - PAD).toFixed(1)} L${first.x.toFixed(1)},${(H - PAD).toFixed(1)} Z`
}

export const daysAgo = (iso: string): number => {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((now.getTime() - d.getTime()) / 86_400_000)
}

export const settlementDate = (iso: string): string => {
  const d = new Date(iso)
  let count = 0
  while (count < 2) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}
