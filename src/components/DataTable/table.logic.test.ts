import { describe, it, expect } from 'vitest'
import {
  sortTrades,
  buildSparklinePoints,
  polylinePath,
  areaPath,
  daysAgo,
  settlementDate,
} from './table.logic'
import type { SortState } from './table.types'
import type { Trade } from '../../data/types'

// ── Fixtures ────────────────────────────────────────────────────────────────

const makeTrade = (overrides: Partial<Trade> & { tradeId: string }): Trade => ({
  tradeId: overrides.tradeId,
  date: overrides.date ?? '2024-01-01',
  quantity: overrides.quantity ?? 100,
  price: overrides.price ?? 10,
  side: overrides.side ?? 'BUY',
})

const TRADES: Trade[] = [
  makeTrade({ tradeId: 'T1', date: '2024-03-01', price: 15, quantity: 200, side: 'BUY' }),
  makeTrade({ tradeId: 'T2', date: '2024-01-15', price: 10, quantity: 50,  side: 'SELL' }),
  makeTrade({ tradeId: 'T3', date: '2024-06-20', price: 20, quantity: 300, side: 'BUY' }),
]

// ── sortTrades ───────────────────────────────────────────────────────────────

describe('sortTrades', () => {
  it('returns original order when sort is null', () => {
    const result = sortTrades(TRADES, null, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T1', 'T2', 'T3'])
  })

  it('sorts by date ascending', () => {
    const sort: SortState = { key: 'date', desc: false }
    const result = sortTrades(TRADES, sort, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T2', 'T1', 'T3'])
  })

  it('sorts by date descending', () => {
    const sort: SortState = { key: 'date', desc: true }
    const result = sortTrades(TRADES, sort, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T3', 'T1', 'T2'])
  })

  it('sorts by price ascending', () => {
    const sort: SortState = { key: 'price', desc: false }
    const result = sortTrades(TRADES, sort, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T2', 'T1', 'T3'])
  })

  it('sorts by qty ascending', () => {
    const sort: SortState = { key: 'qty', desc: false }
    const result = sortTrades(TRADES, sort, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T2', 'T1', 'T3'])
  })

  it('sorts by value (price × qty) ascending', () => {
    // T2: 10×50=500, T1: 15×200=3000, T3: 20×300=6000
    const sort: SortState = { key: 'value', desc: false }
    const result = sortTrades(TRADES, sort, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T2', 'T1', 'T3'])
  })

  it('sorts by delta vs avgCost ascending', () => {
    // avgCost=12: T2 delta=(10-12)/12=-0.167, T1=(15-12)/12=0.25, T3=(20-12)/12=0.667
    const sort: SortState = { key: 'delta', desc: false }
    const result = sortTrades(TRADES, sort, 12)
    expect(result.map(t => t.tradeId)).toEqual(['T2', 'T1', 'T3'])
  })

  it('does not mutate the original array', () => {
    const original = [...TRADES]
    sortTrades(TRADES, { key: 'price', desc: false }, 12)
    expect(TRADES).toEqual(original)
  })

  it('handles a single-trade array', () => {
    const single = [makeTrade({ tradeId: 'T1', price: 10 })]
    const result = sortTrades(single, { key: 'price', desc: true }, 12)
    expect(result).toHaveLength(1)
  })
})

// ── buildSparklinePoints ─────────────────────────────────────────────────────

describe('buildSparklinePoints', () => {
  it('returns empty array for fewer than 2 trades', () => {
    expect(buildSparklinePoints([])).toEqual([])
    expect(buildSparklinePoints([makeTrade({ tradeId: 'T1' })])).toEqual([])
  })

  it('returns one point per trade when >= 2 trades', () => {
    const pts = buildSparklinePoints(TRADES)
    expect(pts).toHaveLength(TRADES.length)
  })

  it('sorts trades by date so first point corresponds to earliest trade', () => {
    const pts = buildSparklinePoints(TRADES)
    // T2 is earliest (2024-01-15), T3 is latest (2024-06-20)
    // first x should be the pad (min), last x should be max
    expect(pts[0]!.x).toBeLessThan(pts[pts.length - 1]!.x)
  })

  it('all y values are within [PAD, H - PAD]', () => {
    const pts = buildSparklinePoints(TRADES)
    for (const p of pts) {
      expect(p.y).toBeGreaterThanOrEqual(2)
      expect(p.y).toBeLessThanOrEqual(18)
    }
  })
})

// ── polylinePath ─────────────────────────────────────────────────────────────

describe('polylinePath', () => {
  it('returns empty string for empty array', () => {
    expect(polylinePath([])).toBe('')
  })

  it('starts with M for the first point', () => {
    const pts = [{ x: 2, y: 5 }, { x: 10, y: 8 }]
    expect(polylinePath(pts)).toMatch(/^M/)
  })

  it('contains L for subsequent points', () => {
    const pts = [{ x: 2, y: 5 }, { x: 10, y: 8 }, { x: 20, y: 3 }]
    const path = polylinePath(pts)
    expect(path).toContain('L')
  })
})

// ── areaPath ─────────────────────────────────────────────────────────────────

describe('areaPath', () => {
  it('returns empty string for empty array', () => {
    expect(areaPath([])).toBe('')
  })

  it('closes the path with Z', () => {
    const pts = [{ x: 2, y: 5 }, { x: 10, y: 8 }]
    expect(areaPath(pts)).toMatch(/Z$/)
  })
})

// ── daysAgo ──────────────────────────────────────────────────────────────────

describe('daysAgo', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(daysAgo(today)).toBe(0)
  })

  it('returns 1 for yesterday', () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
    expect(daysAgo(yesterday)).toBe(1)
  })

  it('returns correct count for older dates', () => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    const iso = d.toISOString().slice(0, 10)
    expect(daysAgo(iso)).toBe(30)
  })
})

// ── settlementDate ───────────────────────────────────────────────────────────

describe('settlementDate', () => {
  it('adds 2 business days for a Wednesday', () => {
    // 2024-01-10 is a Wednesday → settlement Friday 2024-01-12
    const result = settlementDate('2024-01-10')
    expect(result).toContain('12')
    expect(result).toContain('Jan')
  })

  it('handles Friday → Tuesday (skips weekend)', () => {
    // 2024-01-12 is a Friday → settlement Tuesday 2024-01-16
    const result = settlementDate('2024-01-12')
    expect(result).toContain('16')
    expect(result).toContain('Jan')
  })

  it('handles Thursday → Monday (one weekend skip)', () => {
    // 2024-01-11 is a Thursday → +1 = Friday, +2 = Monday 2024-01-15
    const result = settlementDate('2024-01-11')
    expect(result).toContain('15')
    expect(result).toContain('Jan')
  })
})
