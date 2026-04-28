import { describe, it, expect } from 'vitest'
import {
  gaussianSample,
  buildCumulativeWeights,
  generateTradePoints,
  computePriceExtent,
  buildBins,
  findHottestCell,
} from './heatmap.logic'
import type { ExampleConfig, BinCell } from './heatmap.types'

// ── gaussianSample ──────────────────────────────────────────────────────────

describe('gaussianSample', () => {
  it('returns a deterministic value for a deterministic RNG', () => {
    let seed = 0
    const fakeRng = () => { seed = (seed + 0.1) % 1; return seed }
    const v1 = gaussianSample(100, 10, fakeRng)
    seed = 0
    const v2 = gaussianSample(100, 10, fakeRng)
    expect(v1).toBe(v2)
  })

  it('produces output centered near the mean over many samples', () => {
    let s = 1
    const rng = () => {
      s = ((s * 1664525 + 1013904223) | 0)
      return (s >>> 0) / 0x100000000
    }
    const samples = Array.from({ length: 1000 }, () => gaussianSample(100, 10, rng))
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(mean).toBeGreaterThan(90)
    expect(mean).toBeLessThan(110)
  })
})

// ── buildCumulativeWeights ──────────────────────────────────────────────────

describe('buildCumulativeWeights', () => {
  it('returns an array one shorter than the clusters array', () => {
    const clusters = [
      { mean: 150, std: 15, weight: 0.4 },
      { mean: 200, std: 20, weight: 0.35 },
      { mean: 120, std: 10, weight: 0.25 },
    ]
    expect(buildCumulativeWeights(clusters)).toHaveLength(2)
  })

  it('produces correct cumulative thresholds', () => {
    const clusters = [
      { mean: 0, std: 1, weight: 0.4 },
      { mean: 0, std: 1, weight: 0.35 },
      { mean: 0, std: 1, weight: 0.25 },
    ]
    const thresholds = buildCumulativeWeights(clusters)
    expect(thresholds[0]).toBeCloseTo(0.4)
    expect(thresholds[1]).toBeCloseTo(0.75)
  })

  it('returns empty array for a single cluster', () => {
    expect(buildCumulativeWeights([{ mean: 0, std: 1, weight: 1.0 }])).toHaveLength(0)
  })
})

// ── generateTradePoints ─────────────────────────────────────────────────────

const MINIMAL_CONFIG: ExampleConfig = {
  id: 'test',
  label: 'Test',
  seed: 1,
  totalPoints: 500,
  cols: 10,
  rows: 10,
  clusters: [{ mean: 100, std: 10, weight: 1.0 }],
  intro: '',
  description: '',
}

describe('generateTradePoints', () => {
  it('returns an array with the correct length', () => {
    expect(generateTradePoints(MINIMAL_CONFIG)).toHaveLength(500)
  })

  it('all t values are in [0, 1]', () => {
    const points = generateTradePoints(MINIMAL_CONFIG)
    points.forEach(p => {
      expect(p.t).toBeGreaterThanOrEqual(0)
      expect(p.t).toBeLessThanOrEqual(1)
    })
  })

  it('all price values are finite numbers', () => {
    const points = generateTradePoints(MINIMAL_CONFIG)
    points.forEach(p => expect(Number.isFinite(p.price)).toBe(true))
  })

  it('is deterministic — same seed produces identical output', () => {
    const a = generateTradePoints(MINIMAL_CONFIG)
    const b = generateTradePoints(MINIMAL_CONFIG)
    expect(a[0]).toEqual(b[0])
    expect(a[499]).toEqual(b[499])
  })

  it('different seeds produce different output', () => {
    const a = generateTradePoints({ ...MINIMAL_CONFIG, seed: 1 })
    const b = generateTradePoints({ ...MINIMAL_CONFIG, seed: 2 })
    expect(a[0]).not.toEqual(b[0])
  })
})

// ── computePriceExtent ──────────────────────────────────────────────────────

describe('computePriceExtent', () => {
  it('returns [min, max] for a non-empty array', () => {
    const points = [
      { t: 0, price: 50 },
      { t: 0.5, price: 200 },
      { t: 1, price: 100 },
    ]
    expect(computePriceExtent(points)).toEqual([50, 200])
  })

  it('returns [0, 500] for an empty array (fallback)', () => {
    expect(computePriceExtent([])).toEqual([0, 500])
  })
})

// ── buildBins ───────────────────────────────────────────────────────────────

describe('buildBins', () => {
  const points = generateTradePoints(MINIMAL_CONFIG)
  const extent = computePriceExtent(points)

  it('returns a non-empty cells array no larger than cols × rows', () => {
    const cells = buildBins(points, extent, 10, 10)
    expect(cells.length).toBeGreaterThan(0)
    expect(cells.length).toBeLessThanOrEqual(10 * 10)
  })

  it('all normalised values are in [0, 1]', () => {
    const cells = buildBins(points, extent, 10, 10)
    cells.forEach(c => {
      expect(c.normalised).toBeGreaterThanOrEqual(0)
      expect(c.normalised).toBeLessThanOrEqual(1)
    })
  })

  it('the maximum normalised value is exactly 1', () => {
    const cells = buildBins(points, extent, 10, 10)
    const maxNorm = Math.max(...cells.map(c => c.normalised))
    expect(maxNorm).toBeCloseTo(1.0)
  })

  it('total count across all cells equals total points', () => {
    const cells = buildBins(points, extent, 10, 10)
    const totalCount = cells.reduce((sum, c) => sum + c.count, 0)
    expect(totalCount).toBe(500)
  })

  it('all count values are non-negative', () => {
    const cells = buildBins(points, extent, 10, 10)
    cells.forEach(c => expect(c.count).toBeGreaterThanOrEqual(0))
  })
})

// ── findHottestCell ─────────────────────────────────────────────────────────

describe('findHottestCell', () => {
  it('returns the cell with the highest count', () => {
    const cells: BinCell[] = [
      { colIdx: 0, rowIdx: 0, count: 5,  normalised: 0.5, tMin: 0,   tMax: 0.5, priceMin: 0,  priceMax: 50  },
      { colIdx: 0, rowIdx: 1, count: 10, normalised: 1.0, tMin: 0,   tMax: 0.5, priceMin: 50, priceMax: 100 },
      { colIdx: 1, rowIdx: 0, count: 3,  normalised: 0.3, tMin: 0.5, tMax: 1,   priceMin: 0,  priceMax: 50  },
    ]
    expect(findHottestCell(cells)?.count).toBe(10)
  })

  it('returns undefined for an empty array', () => {
    expect(findHottestCell([])).toBeUndefined()
  })
})
