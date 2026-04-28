import * as d3 from 'd3'
import { mulberry32 } from '../../rng'
import type { TradePoint, BinCell, GaussianCluster, ExampleConfig } from './heatmap.types'

// ── Gaussian sampler ────────────────────────────────────────────────────────
// Box-Muller transform: produces normally-distributed values from two uniform
// inputs, which is exactly what mulberry32 provides.

export const gaussianSample = (mean: number, std: number, rng: () => number): number => {
  const u1 = Math.max(1e-10, rng()) // avoid log(0)
  const u2 = rng()
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

// ── Cluster weight → threshold array ────────────────────────────────────────
// Converts cluster weights into cumulative thresholds used in the generation
// loop. Computing this once outside the loop avoids n * clusters.length
// floating-point additions.
// slice(0, -1) drops the last cluster weight — the last cluster is the implicit
// remainder, so its boundary never needs a threshold entry.

export const buildCumulativeWeights = (clusters: GaussianCluster[]): number[] => {
  let cumSum = 0
  return clusters.slice(0, -1).map(c => (cumSum += c.weight))
}

// ── Data generation ─────────────────────────────────────────────────────────

export const generateTradePoints = (config: ExampleConfig): TradePoint[] => {
  const { seed, totalPoints, clusters } = config
  const rng = mulberry32(seed)
  const points: TradePoint[] = new Array(totalPoints)
  const thresholds = buildCumulativeWeights(clusters)

  for (let i = 0; i < totalPoints; i++) {
    // d3.bisectRight returns the insertion index of roll in the sorted thresholds
    // array, which is exactly the cluster index to use — no inner loop needed.
    const cluster = clusters[d3.bisectRight(thresholds, rng())]
    points[i] = {
      t: rng(),
      price: gaussianSample(cluster.mean, cluster.std, rng),
    }
  }

  return points
}

// ── Price extent ────────────────────────────────────────────────────────────

export const computePriceExtent = (points: TradePoint[]): [number, number] => [
  d3.min(points, p => p.price) ?? 0,
  d3.max(points, p => p.price) ?? 500,
]

// ── 2D binning ──────────────────────────────────────────────────────────────
// Produces a flat array of BinCell objects so the D3 data join can iterate
// over them linearly — avoids nested loops in the render effect.

export const buildBins = (
  points: TradePoint[],
  priceExtent: [number, number],
  cols: number,
  rows: number,
): BinCell[] => {
  const [priceMin, priceMax] = priceExtent

  const tBinner = d3
    .bin<TradePoint, number>()
    .value(p => p.t)
    .domain([0, 1])
    .thresholds(d3.range(0, 1, 1 / cols))

  // Hoist pBinner outside the column loop — its config (domain, thresholds) is
  // identical for every column, so building it once avoids cols redundant
  // d3.bin() + d3.range() allocations.
  const pBinner = d3
    .bin<TradePoint, number>()
    .value(p => p.price)
    .domain([priceMin, priceMax])
    .thresholds(d3.range(priceMin, priceMax, (priceMax - priceMin) / rows))

  const cells: BinCell[] = tBinner(points).flatMap((tBucket, colIdx) =>
    pBinner(tBucket).map((pBucket, rowIdx) => ({
      colIdx,
      rowIdx,
      count: pBucket.length,
      normalised: 0,
      tMin: tBucket.x0 ?? 0,
      tMax: tBucket.x1 ?? 1,
      priceMin: pBucket.x0 ?? priceMin,
      priceMax: pBucket.x1 ?? priceMax,
    }))
  )

  const maxCount = d3.max(cells, c => c.count) ?? 1
  cells.forEach(c => { c.normalised = c.count / maxCount })

  return cells
}

// ── Hottest cell ─────────────────────────────────────────────────────────────

export const findHottestCell = (cells: BinCell[]): BinCell | undefined =>
  cells.reduce<BinCell | undefined>(
    (best, c) => (!best || c.count > best.count ? c : best),
    undefined,
  )

// ── D3 axis styling ─────────────────────────────────────────────────────────
// Applied imperatively after D3 renders axis elements outside React's tree.

export const styleAxis = (el: SVGGElement | null): void => {
  if (!el) return
  const sel = d3.select(el)
  sel.select('.domain').attr('stroke', 'var(--border)')
  sel.selectAll('.tick line').attr('stroke', 'var(--border)')
  sel.selectAll('.tick text')
    .attr('fill', 'var(--text-2)')
    .attr('font-size', 10)
    .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
}
