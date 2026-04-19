import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { GalleryFrame } from '../GalleryFrame'
import { mulberry32 } from '../rng'

// ─── Constants ─────────────────────────────────────────────────────────────

const TOTAL_POINTS = 100_000
const SEED = 99
const COLS = 60
const ROWS = 40
const MARGIN = { top: 8, right: 100, bottom: 32, left: 52 } as const

// ─── Types ─────────────────────────────────────────────────────────────────

interface TradePoint {
  t: number      // [0, 1] normalised time
  price: number
}

interface BinCell {
  colIdx: number
  rowIdx: number
  count: number
  normalised: number
  tMin: number
  tMax: number
  priceMin: number
  priceMax: number
}

interface TooltipState {
  containerX: number   // position relative to the outer container div
  containerY: number
  cell: BinCell
}

// ─── Box-Muller Gaussian sampler ───────────────────────────────────────────
// We use Box-Muller because it produces normally-distributed values from two
// uniform inputs, which is exactly what mulberry32 provides.

function gaussianSample(mean: number, std: number, rng: () => number): number {
  const u1 = Math.max(1e-10, rng()) // avoid log(0)
  const u2 = rng()
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + std * z
}

// ─── Data generation ───────────────────────────────────────────────────────

function generateTradePoints(): TradePoint[] {
  const rng = mulberry32(SEED)
  const points: TradePoint[] = new Array(TOTAL_POINTS)

  for (let i = 0; i < TOTAL_POINTS; i++) {
    const roll = rng()
    let price: number

    if (roll < 0.40) {
      // Cluster A: mean 150, std 15
      price = gaussianSample(150, 15, rng)
    } else if (roll < 0.75) {
      // Cluster B: mean 200, std 20
      price = gaussianSample(200, 20, rng)
    } else {
      // Cluster C: mean 120, std 10
      price = gaussianSample(120, 10, rng)
    }

    points[i] = {
      t: rng(),   // uniform [0,1]
      price,
    }
  }

  return points
}

// ─── Binning ───────────────────────────────────────────────────────────────
// We produce a flat array of BinCell objects rather than a 2D array so the
// D3 data join can iterate over them linearly — this avoids nested loops in
// the render effect and is easier to type.

function buildBins(points: TradePoint[]): BinCell[] {
  // Compute price extent across all points so our price axis is stable
  const priceMin = d3.min(points, p => p.price) ?? 0
  const priceMax = d3.max(points, p => p.price) ?? 500

  // d3.bin() divides [0,1] into COLS equal-width buckets on t
  const tBinner = d3
    .bin<TradePoint, number>()
    .value(p => p.t)
    .domain([0, 1])
    .thresholds(d3.range(0, 1, 1 / COLS))

  const tBuckets = tBinner(points)

  const cells: BinCell[] = []

  tBuckets.forEach((tBucket, colIdx) => {
    // Within each time bucket, bin on price into ROWS bins
    const pBinner = d3
      .bin<TradePoint, number>()
      .value(p => p.price)
      .domain([priceMin, priceMax])
      .thresholds(d3.range(priceMin, priceMax, (priceMax - priceMin) / ROWS))

    const pBuckets = pBinner(tBucket)

    pBuckets.forEach((pBucket, rowIdx) => {
      cells.push({
        colIdx,
        rowIdx,
        count: pBucket.length,
        normalised: 0, // filled in below
        tMin: tBucket.x0 ?? 0,
        tMax: tBucket.x1 ?? 1,
        priceMin: pBucket.x0 ?? priceMin,
        priceMax: pBucket.x1 ?? priceMax,
      })
    })
  })

  // Normalise counts so the colour scale spans [0, 1]
  const maxCount = d3.max(cells, c => c.count) ?? 1
  cells.forEach(c => { c.normalised = c.count / maxCount })

  return cells
}

// ─── Hottest cell annotation ───────────────────────────────────────────────

function findHottestCell(cells: BinCell[]): BinCell | undefined {
  return cells.reduce<BinCell | undefined>((best, c) => {
    if (!best || c.count > best.count) return c
    return best
  }, undefined)
}

// ─── Component ─────────────────────────────────────────────────────────────

export function DensityHeatmap() {
  const svgRef        = useRef<SVGSVGElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const cellGRef      = useRef<SVGGElement>(null)
  const xAxisRef      = useRef<SVGGElement>(null)
  const yAxisRef      = useRef<SVGGElement>(null)
  const legendRectRef = useRef<SVGRectElement>(null)
  // Highlight rect — repositioned via setAttribute (no D3 redraw)
  const highlightRectRef = useRef<SVGRectElement>(null)

  const [innerW, setInnerW] = useState(600)
  const [innerH, setInnerH] = useState(400)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // ─── Data (generated once) ──────────────────────────────────────────────
  const rawPoints = useMemo<TradePoint[]>(() => generateTradePoints(), [])
  const cells = useMemo<BinCell[]>(() => buildBins(rawPoints), [rawPoints])

  // Compute stable price extent from all cells for consistent axes
  const priceExtent = useMemo<[number, number]>(() => {
    const allPrices = rawPoints.map(p => p.price)
    return [d3.min(allPrices) ?? 0, d3.max(allPrices) ?? 500]
  }, [rawPoints])

  // Precompute hottest cell for the annotation label
  const hottestCell = useMemo(() => findHottestCell(cells), [cells])

  // ─── ResizeObserver ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setInnerW(rect.width  - MARGIN.left - MARGIN.right)
      setInnerH(rect.height - MARGIN.top  - MARGIN.bottom)
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── D3 cell render ─────────────────────────────────────────────────────
  // We use a D3 data join here (not React .map) because:
  // 1. 2,400 SVG elements are manageable for SVG but would be slow as React
  //    reconciled virtual DOM nodes on every dimension change.
  // 2. D3's enter/update/exit pattern efficiently patches only changed attrs.
  useEffect(() => {
    const cellG = d3.select(cellGRef.current)
    cellG.selectAll('*').remove()

    const xScale = d3.scaleLinear([0, 1], [0, innerW])
    const yScale = d3.scaleLinear(priceExtent, [innerH, 0])

    // Each cell's pixel dimensions
    const cellW = innerW / COLS
    const cellH = innerH / ROWS

    cellG
      .selectAll<SVGRectElement, BinCell>('rect')
      .data(cells)
      .join('rect')
      .attr('x',      c => xScale(c.tMin))
      .attr('y',      c => yScale(c.priceMax))
      .attr('width',  cellW)
      .attr('height', cellH)
      .attr('fill',   c => d3.interpolateViridis(c.normalised))

    // ── X axis ──
    if (xAxisRef.current) {
      d3.select<SVGGElement, unknown>(xAxisRef.current).call(
        d3
          .axisBottom(xScale)
          .ticks(6)
          .tickFormat(d => {
            const month = Math.round(+d * 12)
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
            return months[Math.min(month, 11)] ?? ''
          })
          .tickSize(4)
      )
      styleAxis(xAxisRef.current)
    }

    // ── Y axis (price) ──
    if (yAxisRef.current) {
      d3.select<SVGGElement, unknown>(yAxisRef.current).call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat(d => `$${(+d).toFixed(0)}`)
          .tickSize(4)
      )
      styleAxis(yAxisRef.current)
    }

  }, [cells, innerW, innerH, priceExtent])

  // ─── Viridis legend (gradient) ───────────────────────────────────────────
  useEffect(() => {
    const legendH = innerH * 0.6
    const legendY = (innerH - legendH) / 2

    if (legendRectRef.current) {
      legendRectRef.current.setAttribute('height', String(legendH))
      legendRectRef.current.setAttribute('y', String(legendY))
    }
  }, [innerH])

  // ─── Mouse tooltip + highlight rect ──────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const svgEl    = svgRef.current
    const container = containerRef.current
    if (!svgEl || !container) return

    const svgRect = svgEl.getBoundingClientRect()
    // Position relative to the plot area (account for margins)
    const plotX = e.clientX - svgRect.left - MARGIN.left
    const plotY = e.clientY - svgRect.top  - MARGIN.top

    // Map pixel → cell indices
    const colIdx = Math.max(0, Math.min(COLS - 1, Math.floor((plotX / innerW) * COLS)))
    const rowIdx = Math.max(0, Math.min(ROWS - 1, Math.floor((plotY / innerH) * ROWS)))

    const cell = cells.find(c => c.colIdx === colIdx && c.rowIdx === rowIdx)
    if (!cell) return

    // Update highlight rect via setAttribute — no setState for SVG elements
    const cellW = innerW / COLS
    const cellH = innerH / ROWS
    if (highlightRectRef.current) {
      highlightRectRef.current.setAttribute('x', String((colIdx / COLS) * innerW))
      highlightRectRef.current.setAttribute('y', String((rowIdx / ROWS) * innerH))
      highlightRectRef.current.setAttribute('width', String(cellW))
      highlightRectRef.current.setAttribute('height', String(cellH))
      highlightRectRef.current.setAttribute('visibility', 'visible')
    }

    const containerRect = container.getBoundingClientRect()
    setTooltip({
      containerX: e.clientX - containerRect.left,
      containerY: e.clientY - containerRect.top,
      cell,
    })
  }, [cells, innerW, innerH])

  const handleMouseLeave = useCallback(() => {
    if (highlightRectRef.current) {
      highlightRectRef.current.setAttribute('visibility', 'hidden')
    }
    setTooltip(null)
  }, [])

  const legendH = innerH * 0.6
  const legendY = (innerH - legendH) / 2
  const legendX = innerW + 16  // right of plot area, within the extra right margin

  // Annotation position for the hottest cell
  const hottestAnnotation = useMemo(() => {
    if (!hottestCell) return null
    const xScale = d3.scaleLinear([0, 1], [0, innerW])
    const yScale = d3.scaleLinear(priceExtent, [innerH, 0])
    return {
      x: xScale(hottestCell.tMin) + (innerW / COLS) / 2,
      y: yScale(hottestCell.priceMax) - 6,
    }
  }, [hottestCell, innerW, innerH, priceExtent])

  return (
    <GalleryFrame
      title="Density Heatmap"
      intro="Hover any cell to see exact count and bin range. The peak-density cell is annotated."
      description="100,000 synthetic trade events binned into a 60x40 grid. At this density a scatter plot is opaque — heatmapping makes the distribution legible. Viridis colour scale, SVG rect grid, d3.bin() on both axes."
      totalPoints={TOTAL_POINTS}
      renderedPoints={TOTAL_POINTS}
      height={480}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>

        {/* JSX tooltip bubble */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.containerX + 10,
              top: tooltip.containerY - 60,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '5px 9px',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            {[
              `Count: ${tooltip.cell.count.toLocaleString()}`,
              `Price: $${tooltip.cell.priceMin.toFixed(0)}\u2013$${tooltip.cell.priceMax.toFixed(0)}`,
              `Time: ${(tooltip.cell.tMin * 12).toFixed(1)}\u2013${(tooltip.cell.tMax * 12).toFixed(1)} mo`,
            ].map(line => (
              <div key={line} style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-1)', lineHeight: 1.6 }}>
                {line}
              </div>
            ))}
          </div>
        )}

        <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            {/* Viridis gradient for the legend — 10 stops from bottom (0) to top (1) */}
            <linearGradient id="viridis-legend" x1="0" x2="0" y1="1" y2="0">
              {d3.range(0, 1.01, 0.1).map((t, i) => (
                <stop
                  key={i}
                  offset={`${(t * 100).toFixed(0)}%`}
                  stopColor={d3.interpolateViridis(t)}
                />
              ))}
            </linearGradient>
          </defs>

          {/* ── Plot group ── */}
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Heat cells (D3-managed) */}
            <g ref={cellGRef} />

            {/* Highlight rect — Option B style: positioned via setAttribute */}
            <rect
              ref={highlightRectRef}
              x={0}
              y={0}
              width={0}
              height={0}
              fill="none"
              stroke="white"
              strokeWidth={1.5}
              opacity={0.8}
              pointerEvents="none"
              visibility="hidden"
            />

            {/* Peak-density annotation */}
            {hottestCell && hottestAnnotation && (
              <g pointerEvents="none">
                <line
                  x1={hottestAnnotation.x}
                  y1={hottestAnnotation.y}
                  x2={hottestAnnotation.x}
                  y2={hottestAnnotation.y - 14}
                  stroke="var(--text-1)"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text
                  x={hottestAnnotation.x}
                  y={hottestAnnotation.y - 17}
                  textAnchor="middle"
                  fill="var(--text-1)"
                  fontSize={9}
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  opacity={0.8}
                >
                  peak: {hottestCell.count.toLocaleString()}
                </text>
              </g>
            )}

            {/* Invisible overlay for mouse events — full plot area */}
            <rect
              x={0}
              y={0}
              width={innerW}
              height={innerH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />

            {/* X axis */}
            <g ref={xAxisRef} transform={`translate(0,${innerH})`} />

            {/* Y axis */}
            <g ref={yAxisRef} />

            {/* ── Color legend ── */}
            <g transform={`translate(${legendX}, 0)`}>
              <rect
                ref={legendRectRef}
                x={0}
                y={legendY}
                width={12}
                height={legendH}
                fill="url(#viridis-legend)"
              />
              <text
                x={16}
                y={legendY + 6}
                fill="var(--text-2)"
                fontSize={9}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
              >
                High
              </text>
              <text
                x={16}
                y={legendY + legendH}
                fill="var(--text-2)"
                fontSize={9}
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
              >
                Low
              </text>
            </g>
          </g>
        </svg>
      </div>
    </GalleryFrame>
  )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function styleAxis(el: SVGGElement | null) {
  if (!el) return
  const sel = d3.select(el)
  sel.select('.domain').attr('stroke', 'var(--border)')
  sel.selectAll('.tick line').attr('stroke', 'var(--border)')
  sel.selectAll('.tick text')
    .attr('fill', 'var(--text-2)')
    .attr('font-size', 10)
    .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
}
