import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import type { BinCell, TooltipState } from './heatmap.types'
import { styleAxis, findHottestCell } from './heatmap.logic'
import styles from './heatmap.module.css'

const MARGIN = { top: 8, right: 100, bottom: 32, left: 52 } as const

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

const COLOR_SCALES: Record<string, (t: number) => string> = {
  viridis: d3.interpolateViridis,
  inferno: d3.interpolateInferno,
  magma:   d3.interpolateMagma,
  plasma:  d3.interpolatePlasma,
  warm:    d3.interpolateWarm,
  cool:    d3.interpolateCool,
}

// Piecewise RGB interpolator from [t, color] stops.
// Cheaper than d3.scaleLinear for arbitrary-domain stops and avoids function
// reference churn that would re-trigger the D3 useEffect on every render.
function buildStopInterpolator(stops: [number, string][]): (t: number) => string {
  const n = stops.length
  return (t: number) => {
    const clamped = Math.max(stops[0]![0], Math.min(stops[n - 1]![0], t))
    for (let i = 0; i < n - 1; i++) {
      const [lo, loC] = stops[i]!
      const [hi, hiC] = stops[i + 1]!
      if (clamped <= hi) {
        const p = hi === lo ? 0 : (clamped - lo) / (hi - lo)
        return d3.interpolateRgb(loC, hiC)(p)
      }
    }
    return stops[n - 1]![1]
  }
}

interface HeatmapChartProps {
  cells: BinCell[]
  priceExtent: [number, number]
  cols: number
  rows: number
  colorScale?: string
  colorScaleFloor?: number
  colorStops?: [number, string][]
  chartBackground?: string
}

export const HeatmapChart = ({
  cells, priceExtent, cols, rows,
  colorScale, colorScaleFloor, colorStops, chartBackground,
}: HeatmapChartProps) => {

  // Stable interpolator — only rebuilds when scale config changes, not on every render.
  const interpolate = useMemo<(t: number) => string>(() => {
    if (colorStops && colorStops.length >= 2) {
      return buildStopInterpolator(colorStops)
    }
    const named = COLOR_SCALES[colorScale ?? 'viridis'] ?? d3.interpolateViridis
    const fl = colorScaleFloor ?? 0
    return fl > 0 ? (t: number) => named(fl + t * (1 - fl)) : named
  }, [colorStops, colorScale, colorScaleFloor])

  const svgRef           = useRef<SVGSVGElement>(null)
  const containerRef     = useRef<HTMLDivElement>(null)
  const cellGRef         = useRef<SVGGElement>(null)
  const xAxisRef         = useRef<SVGGElement>(null)
  const yAxisRef         = useRef<SVGGElement>(null)
  const legendRectRef    = useRef<SVGRectElement>(null)
  const highlightRectRef = useRef<SVGRectElement>(null)

  const [innerW, setInnerW] = useState(600)
  const [innerH, setInnerH] = useState(400)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const hottestCell = useMemo(() => findHottestCell(cells), [cells])

  // ── ResizeObserver ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setInnerW(rect.width  - MARGIN.left - MARGIN.right)
      setInnerH(rect.height - MARGIN.top  - MARGIN.bottom)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── D3 cell render + axes ───────────────────────────────────────────────
  // D3 data join is used here (not React .map) because 2,400 SVG rects would
  // be slow to reconcile through React's virtual DOM on every resize.
  useEffect(() => {
    const cellG = d3.select(cellGRef.current)
    cellG.selectAll('*').remove()

    const xScale = d3.scaleLinear([0, 1], [0, innerW])
    const yScale = d3.scaleLinear(priceExtent, [innerH, 0])
    const cellW  = innerW / cols
    const cellH  = innerH / rows

    cellG
      .selectAll<SVGRectElement, BinCell>('rect')
      .data(cells)
      .join('rect')
      .attr('x',      c => xScale(c.tMin))
      .attr('y',      c => yScale(c.priceMax))
      .attr('width',  cellW)
      .attr('height', cellH)
      .attr('fill',   c => interpolate(c.normalised))

    if (xAxisRef.current) {
      d3.select<SVGGElement, unknown>(xAxisRef.current).call(
        d3.axisBottom(xScale)
          .ticks(6)
          .tickFormat(d => {
            const month = Math.round(+d * 12)
            return MONTH_LABELS[Math.min(month, 11)] ?? ''
          })
          .tickSize(4)
      )
      styleAxis(xAxisRef.current)
    }

    if (yAxisRef.current) {
      d3.select<SVGGElement, unknown>(yAxisRef.current).call(
        d3.axisLeft(yScale)
          .ticks(5)
          .tickFormat(d => `$${(+d).toFixed(0)}`)
          .tickSize(4)
      )
      styleAxis(yAxisRef.current)
    }
  }, [cells, cols, rows, innerW, innerH, priceExtent, interpolate])

  // ── Legend sizing ───────────────────────────────────────────────────────
  useEffect(() => {
    const legendH = innerH * 0.6
    const legendY = (innerH - legendH) / 2
    if (legendRectRef.current) {
      legendRectRef.current.setAttribute('height', String(legendH))
      legendRectRef.current.setAttribute('y', String(legendY))
    }
  }, [innerH])

  // ── Pointer events (mouse + touch) ──────────────────────────────────────
  // setPointerCapture routes all subsequent pointer events to this element for
  // the life of the gesture, which suppresses the browser's scroll heuristic
  // even on browsers that don't honour touch-action on SVG children.
  const handlePointerDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svgEl     = svgRef.current
    const container = containerRef.current
    if (!svgEl || !container) return

    const svgRect = svgEl.getBoundingClientRect()
    const plotX = e.clientX - svgRect.left - MARGIN.left
    const plotY = e.clientY - svgRect.top  - MARGIN.top

    const colIdx = Math.max(0, Math.min(cols - 1, Math.floor((plotX / innerW) * cols)))
    const rowIdx = Math.max(0, Math.min(rows - 1, Math.floor((plotY / innerH) * rows)))

    const cell = cells.find(c => c.colIdx === colIdx && c.rowIdx === rowIdx)
    if (!cell) return

    const cellW = innerW / cols
    const cellH = innerH / rows
    if (highlightRectRef.current) {
      highlightRectRef.current.setAttribute('x',          String((colIdx / cols) * innerW))
      highlightRectRef.current.setAttribute('y',          String((rowIdx / rows) * innerH))
      highlightRectRef.current.setAttribute('width',      String(cellW))
      highlightRectRef.current.setAttribute('height',     String(cellH))
      highlightRectRef.current.setAttribute('visibility', 'visible')
    }

    const containerRect = container.getBoundingClientRect()
    setTooltip({
      containerX: e.clientX - containerRect.left,
      containerY: e.clientY - containerRect.top,
      cell,
    })
  }, [cells, cols, rows, innerW, innerH])

  const handlePointerLeave = useCallback(() => {
    if (highlightRectRef.current) {
      highlightRectRef.current.setAttribute('visibility', 'hidden')
    }
    setTooltip(null)
  }, [])

  // ── Derived legend geometry ─────────────────────────────────────────────
  const legendH = innerH * 0.6
  const legendY = (innerH - legendH) / 2
  const legendX = innerW + 16

  // ── Peak annotation position ────────────────────────────────────────────
  const hottestAnnotation = useMemo(() => {
    if (!hottestCell) return null
    const xScale = d3.scaleLinear([0, 1], [0, innerW])
    const yScale = d3.scaleLinear(priceExtent, [innerH, 0])
    return {
      x: xScale(hottestCell.tMin) + (innerW / cols) / 2,
      y: yScale(hottestCell.priceMax) - 6,
    }
  }, [hottestCell, cols, innerW, innerH, priceExtent])

  return (
    <div ref={containerRef} className={styles.container}>

      {tooltip && (
        <div
          role="tooltip"
          id="heatmap-tooltip"
          className={styles.tooltip}
          style={{ left: tooltip.containerX + 10, top: tooltip.containerY - 60 }}
        >
          {[
            `Count: ${tooltip.cell.count.toLocaleString()}`,
            `Price: $${tooltip.cell.priceMin.toFixed(0)}–$${tooltip.cell.priceMax.toFixed(0)}`,
            `Time: ${(tooltip.cell.tMin * 12).toFixed(1)}–${(tooltip.cell.tMax * 12).toFixed(1)} mo`,
          ].map(line => (
            <div key={line} className={styles.tooltipLine}>{line}</div>
          ))}
        </div>
      )}

      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        role="img"
        aria-label="Density heatmap"
        className={styles.svgRoot}
      >
        <defs>
          {/* Colour legend gradient — 10 stops bottom (0) → top (1) */}
          <linearGradient id="heatmap-gradient" x1="0" x2="0" y1="1" y2="0">
            {d3.range(0, 1.01, 0.1).map((t, i) => (
              <stop
                key={i}
                offset={`${(t * 100).toFixed(0)}%`}
                stopColor={interpolate(t)}
              />
            ))}
          </linearGradient>
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Canvas background — visible between colour blocks and at edges */}
          {chartBackground && (
            <rect x={0} y={0} width={innerW} height={innerH} fill={chartBackground} />
          )}

          {/* Heat cells — D3-managed for performance */}
          <g ref={cellGRef} />

          {/* Highlight rect — repositioned via setAttribute (no D3 redraw) */}
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

          {/* Full-plot-area pointer capture — handles both mouse and touch */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            aria-describedby="heatmap-tooltip"
            className={styles.overlayRect}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />

          {/* Axes */}
          <g ref={xAxisRef} transform={`translate(0,${innerH})`} />
          <g ref={yAxisRef} />

          {/* Colour legend */}
          <g transform={`translate(${legendX}, 0)`}>
            <rect
              ref={legendRectRef}
              x={0}
              y={legendY}
              width={12}
              height={legendH}
              fill="url(#heatmap-gradient)"
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
  )
}
