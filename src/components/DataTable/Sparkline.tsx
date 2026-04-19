import { useMemo } from 'react'
import type { Trade } from '../../data/types'

interface Props {
  trades: Trade[]
  pnlDollar: number
}

const W = 60
const H = 20
const PAD = 2

function buildPoints(trades: Trade[]): { x: number; y: number }[] {
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

function polyline(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
}

function areaPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  const line = polyline(pts)
  const last = pts[pts.length - 1]!
  const first = pts[0]!
  return `${line} L${last.x.toFixed(1)},${(H - PAD).toFixed(1)} L${first.x.toFixed(1)},${(H - PAD).toFixed(1)} Z`
}

export function Sparkline({ trades, pnlDollar }: Props) {
  const pts = useMemo(() => buildPoints(trades), [trades])

  if (pts.length < 2) return null

  const colour = pnlDollar >= 0 ? 'var(--positive)' : 'var(--negative)'

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', overflow: 'visible' }}
      aria-hidden="true"
    >
      <path d={areaPath(pts)} fill={colour} opacity={0.15} />
      <path d={polyline(pts)} fill="none" stroke={colour} strokeWidth={1} opacity={0.7} />
    </svg>
  )
}
