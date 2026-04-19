import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { GalleryFrame } from '../GalleryFrame'
import { mulberry32 } from '../rng'

// ─── Types ─────────────────────────────────────────────────────────────────

interface OhlcBar {
  date: string   // ISO date string, e.g. "2022-01-03"
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─── Constants ─────────────────────────────────────────────────────────────

const TOTAL_BARS = 504      // 2 years × 252 trading days
const SEED = 42
const MARGIN = { top: 8, right: 20, bottom: 32, left: 52 } as const
const DEFAULT_VISIBLE = 60  // bars shown by default

// ─── Data generation ───────────────────────────────────────────────────────

function generateOhlc(): OhlcBar[] {
  const rng = mulberry32(SEED)
  const bars: OhlcBar[] = []

  // Starting date: 2 years ago from a fixed reference so data is stable
  const startDate = new Date('2022-01-03')
  let prevClose = 150

  for (let i = 0; i < TOTAL_BARS; i++) {
    // Skip weekends — advance day until Monday–Friday
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)

    const open = prevClose
    let close = open + (rng() - 0.5) * 4
    const high = Math.max(open, close) + rng() * 2
    const low  = Math.min(open, close) - rng() * 2
    const volume = Math.floor(rng() * 5_000_000 + 500_000)

    // Clamp prices
    close = Math.min(Math.max(close, 10), 1000)

    bars.push({
      date: d.toISOString().slice(0, 10),
      open,
      high: Math.min(high, 1000),
      low: Math.max(low, 10),
      close,
      volume,
    })

    prevClose = close
  }

  return bars
}

// ─── Tooltip state ─────────────────────────────────────────────────────────

interface TooltipState {
  containerX: number   // px relative to the outermost container div
  containerY: number
  bar: OhlcBar
}

// ─── Component ─────────────────────────────────────────────────────────────

export function OhlcCandlestick() {
  const svgRef           = useRef<SVGSVGElement>(null)
  const containerRef     = useRef<HTMLDivElement>(null)
  const candleGRef       = useRef<SVGGElement>(null)
  const xAxisRef         = useRef<SVGGElement>(null)
  const yAxisRef         = useRef<SVGGElement>(null)
  const volGRef          = useRef<SVGGElement>(null)
  const volAxisRef       = useRef<SVGGElement>(null)
  const brushGRef        = useRef<SVGGElement>(null)
  const brushRef         = useRef<d3.BrushBehavior<unknown> | null>(null)

  // Option B: a single <rect> that gets repositioned on hover via setAttribute.
  // No D3 redraw is triggered. The rect lives permanently in the SVG and is
  // hidden (width=0) when no bar is hovered.
  const highlightRectRef = useRef<SVGRectElement>(null)
  const crosshairXRef    = useRef<SVGLineElement>(null)

  const [innerW, setInnerW] = useState(800)
  const [innerH, setInnerH] = useState(400) // will be updated by ResizeObserver

  // visibleRange: [startIdx, endIdx] into the bars array (exclusive end)
  const [visibleRange, setVisibleRange] = useState<[number, number]>([
    TOTAL_BARS - DEFAULT_VISIBLE,
    TOTAL_BARS,
  ])

  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const data = useMemo<OhlcBar[]>(() => generateOhlc(), [])

  const visibleBars = useMemo(
    () => data.slice(visibleRange[0], visibleRange[1]),
    [data, visibleRange]
  )

  // ─── Panel heights ────────────────────────────────────────────────────
  // Candle panel = 75% of inner height, volume panel = 25%, with 8px gap
  const candleH = Math.max(0, innerH * 0.75)
  const volPanelH = Math.max(0, innerH * 0.25 - 8)
  const volPanelY = candleH + 8

  // ─── ResizeObserver ───────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      setInnerW(rect.width - MARGIN.left - MARGIN.right)
      setInnerH(rect.height - MARGIN.top - MARGIN.bottom)
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // We need xScale accessible in mousemove without recreating it.
  // Cache its current value in a ref updated by the D3 effect.
  const xScaleRef = useRef<d3.ScaleBand<string>>(d3.scaleBand())

  // drawForRangeRef: live-preview function set inside the D3 effect.
  // Brush 'brush' handler calls this directly to redraw candles without setState.
  const drawForRangeRef = useRef<((i0: number, i1: number) => void) | null>(null)

  // ─── Main D3 render ───────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current) return

    const allDates  = data.map(b => b.date)
    const visDates  = visibleBars.map(b => b.date)

    // xScale for candles: scaleBand over visible dates
    const xScale = d3
      .scaleBand()
      .domain(visDates)
      .range([0, innerW])
      .padding(0.2)

    // Cache for mousemove handler
    xScaleRef.current = xScale

    // yScale for candles: price range with 2% padding
    const priceMin = d3.min(visibleBars, b => b.low)  ?? 0
    const priceMax = d3.max(visibleBars, b => b.high) ?? 100
    const pricePad = (priceMax - priceMin) * 0.02
    const yScale = d3
      .scaleLinear()
      .domain([priceMin - pricePad, priceMax + pricePad])
      .range([candleH, 0])

    // ── Candle drawing helper — called once on mount and by live-preview ──
    const drawCandles = (bars: OhlcBar[], xs: d3.ScaleBand<string>, ys: d3.ScaleLinear<number, number>) => {
      const candleG = d3.select(candleGRef.current)
      candleG.selectAll('*').remove()

      bars.forEach(bar => {
        const bx = xs(bar.date) ?? 0
        const bw = xs.bandwidth()
        const isUp = bar.close >= bar.open
        const color = isUp ? 'var(--positive)' : 'var(--negative)'
        const bodyY = ys(Math.max(bar.open, bar.close))
        const bodyH = Math.max(1, Math.abs(ys(bar.open) - ys(bar.close)))

        candleG.append('line')
          .attr('x1', bx + bw / 2).attr('x2', bx + bw / 2)
          .attr('y1', ys(bar.high)).attr('y2', ys(bar.low))
          .attr('stroke', color).attr('stroke-width', 1)

        candleG.append('rect')
          .attr('x', bx).attr('y', bodyY)
          .attr('width', bw).attr('height', bodyH)
          .attr('fill', color)
      })
    }

    // Draw initial candle view
    drawCandles(visibleBars, xScale, yScale)

    // ── Candle X axis (date labels, ~6 ticks) ──
    const tickStep = Math.max(1, Math.floor(visDates.length / 6))
    const tickValues = visDates.filter((_, i) => i % tickStep === 0)

    if (xAxisRef.current) {
      d3.select<SVGGElement, unknown>(xAxisRef.current).call(
        d3
          .axisBottom(xScale)
          .tickValues(tickValues)
          .tickFormat(d => {
            const date = new Date(d as string)
            return `${date.toLocaleString('default', { month: 'short' })} '${String(date.getFullYear()).slice(2)}`
          })
          .tickSize(4)
      )
      styleAxis(xAxisRef.current)
    }

    // ── Candle Y axis (price) ──
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

    // ── Volume bars ──
    const volMax = d3.max(data, b => b.volume) ?? 1

    // xScale for volume: full dataset (brush controls visible subset via position)
    const xScaleVol = d3
      .scaleBand()
      .domain(allDates)
      .range([0, innerW])
      .padding(0.1)

    const yScaleVol = d3
      .scaleLinear()
      .domain([0, volMax])
      .range([volPanelH, 0])

    const volG = d3.select(volGRef.current)
    volG.selectAll('*').remove()

    data.forEach(bar => {
      const bx = xScaleVol(bar.date) ?? 0
      const bw = Math.max(1, xScaleVol.bandwidth())

      volG
        .append('rect')
        .attr('x', bx)
        .attr('y', yScaleVol(bar.volume))
        .attr('width', bw)
        .attr('height', Math.max(0, volPanelH - yScaleVol(bar.volume)))
        .attr('fill', 'var(--text-2)')
        .attr('opacity', 0.5)
    })

    // ── Volume axis (abbreviated K/M) ──
    if (volAxisRef.current) {
      d3.select<SVGGElement, unknown>(volAxisRef.current).call(
        d3
          .axisLeft(yScaleVol)
          .ticks(3)
          .tickFormat(d => {
            const v = +d
            if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
            if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
            return String(v)
          })
          .tickSize(4)
      )
      styleAxis(volAxisRef.current)
    }

    // ── Brush on volume panel ──
    // Convert visible range [startIdx, endIdx] to pixel positions using xScaleVol
    const startDate = allDates[visibleRange[0]]
    const endDate   = allDates[visibleRange[1] - 1]

    const brushX0 = xScaleVol(startDate) ?? 0
    const brushX1 = (xScaleVol(endDate) ?? innerW) + xScaleVol.bandwidth()

    // drawForRange: live preview used by the 'brush' handler.
    // Redraws candles for an arbitrary index range without touching React state.
    const drawForRange = (i0: number, i1: number) => {
      const bars = data.slice(i0, i1)
      if (bars.length === 0) return
      const dates = bars.map(b => b.date)
      const xs = d3.scaleBand<string>().domain(dates).range([0, innerW]).padding(0.2)
      const pMin = d3.min(bars, b => b.low)  ?? 0
      const pMax = d3.max(bars, b => b.high) ?? 100
      const pPad = (pMax - pMin) * 0.02
      const ys = d3.scaleLinear()
        .domain([pMin - pPad, pMax + pPad])
        .range([candleH, 0])
      drawCandles(bars, xs, ys)
      xScaleRef.current = xs
    }
    drawForRangeRef.current = drawForRange

    // Use a local variable so the 'end' handler can call brush.move to restore
    // the visual selection after a plain click (no drag).
    let brushSel: d3.Selection<SVGGElement, unknown, null, undefined> | null = null

    const brush = d3
      .brushX()
      .extent([[0, 0], [innerW, volPanelH]])
      .on('brush', (event: d3.D3BrushEvent<unknown>) => {
        // Guard: sourceEvent is null for programmatic brush.move calls.
        if (!event.sourceEvent) return
        if (!event.selection) return
        const [x0, x1] = event.selection as [number, number]
        const eachBand = innerW / allDates.length
        const i0 = Math.max(0, Math.floor(x0 / eachBand))
        const i1 = Math.min(allDates.length, Math.ceil(x1 / eachBand))
        if (i1 > i0) drawForRange(i0, i1)
      })
      .on('end', (event: d3.D3BrushEvent<unknown>) => {
        // THE FIX: ignore programmatic moves (sourceEvent is null for brush.move).
        // Without this guard: brush.move → 'end' → setState → re-render → effect
        // re-runs → brush.move again → "Maximum update depth exceeded".
        if (!event.sourceEvent) return

        if (!event.selection) {
          // Click without drag: restore the visual brush to the current range.
          brushSel?.call(brush.move, [brushX0, brushX1])
          return
        }

        const [x0, x1] = event.selection as [number, number]
        const eachBand = innerW / allDates.length
        const i0 = Math.max(0, Math.floor(x0 / eachBand))
        const i1 = Math.min(allDates.length, Math.ceil(x1 / eachBand))
        if (i1 > i0) setVisibleRange([i0, i1])
      })

    brushRef.current = brush

    if (brushGRef.current) {
      brushSel = d3.select<SVGGElement, unknown>(brushGRef.current)
      brushSel.call(brush)
      // Restore brush position — fires events with sourceEvent=null, which the
      // 'end' guard ignores. No loop.
      brushSel.call(brush.move, [brushX0, brushX1])
      brushSel.select('.selection')
        .attr('fill', 'var(--accent)')
        .attr('fill-opacity', 0.15)
        .attr('stroke', 'var(--accent)')
        .attr('stroke-width', 1)
    }

  }, [data, visibleBars, visibleRange, innerW, innerH, candleH, volPanelH])

  // ─── Hover handlers ───────────────────────────────────────────────────
  // Option B: the highlight rect and crosshair line are SVG elements that
  // exist permanently in the DOM. On hover we move them via setAttribute —
  // no D3 redraw, no React state update for the SVG elements.

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    const svgRect = svg.getBoundingClientRect()
    // plotX is relative to the candle panel's plot area
    const plotX = e.clientX - svgRect.left - MARGIN.left

    // Find the hovered band using scaleBand
    const xScale = xScaleRef.current
    const dates  = xScale.domain()
    const bw     = xScale.bandwidth()
    const step   = xScale.step()   // bandwidth + padding gap

    // Compute band index from pixel position
    const rawIdx = Math.floor(plotX / step)
    const clampedIdx = Math.max(0, Math.min(rawIdx, dates.length - 1))
    const hoveredDate = dates[clampedIdx]
    if (!hoveredDate) return

    const bandX = xScale(hoveredDate) ?? 0

    // Move highlight rect via setAttribute — no D3 redraw
    if (highlightRectRef.current) {
      highlightRectRef.current.setAttribute('x', String(bandX))
      highlightRectRef.current.setAttribute('width', String(bw))
      highlightRectRef.current.setAttribute('visibility', 'visible')
    }

    // Move crosshair vertical line to band centre
    const cx = bandX + bw / 2
    if (crosshairXRef.current) {
      crosshairXRef.current.setAttribute('x1', String(cx))
      crosshairXRef.current.setAttribute('x2', String(cx))
      crosshairXRef.current.setAttribute('visibility', 'visible')
    }

    // JSX tooltip — setState is fine here (user-paced event, not rAF)
    const bar = visibleBars.find(b => b.date === hoveredDate)
    if (!bar) return

    const containerRect = container.getBoundingClientRect()
    setTooltip({
      containerX: e.clientX - containerRect.left,
      containerY: e.clientY - containerRect.top,
      bar,
    })
  }, [visibleBars])

  const handleMouseLeave = useCallback(() => {
    if (highlightRectRef.current) {
      highlightRectRef.current.setAttribute('visibility', 'hidden')
    }
    if (crosshairXRef.current) {
      crosshairXRef.current.setAttribute('visibility', 'hidden')
    }
    setTooltip(null)
  }, [])

  return (
    <GalleryFrame
      title="OHLC Candlestick"
      intro="Hover a candle to see OHLCV details. Drag the volume panel to change the visible range."
      description="504 trading days with a volume-brush focus panel. Drag the lower panel to zoom the candlestick view. SVG line wicks, scaleBand bodies, brushX selection."
      totalPoints={TOTAL_BARS}
      renderedPoints={visibleBars.length}
      height={480}
    >
      {/* Relative container so the JSX tooltip can be absolutely positioned */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>

        {/* JSX tooltip bubble */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.containerX + 14 > innerW ? tooltip.containerX - 154 : tooltip.containerX + 14,
              top: tooltip.containerY - 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '6px 10px',
              pointerEvents: 'none',
              zIndex: 20,
              minWidth: 140,
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)', marginBottom: 4 }}>
              {tooltip.bar.date}
            </div>
            {[
              ['O', tooltip.bar.open.toFixed(2)],
              ['H', tooltip.bar.high.toFixed(2)],
              ['L', tooltip.bar.low.toFixed(2)],
              ['C', tooltip.bar.close.toFixed(2)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>{label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-1)' }}>${val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginTop: 2 }}>
              <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>Vol</span>
              <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-1)' }}>
                {(tooltip.bar.volume / 1_000_000).toFixed(2)}M
              </span>
            </div>
          </div>
        )}

        <svg ref={svgRef} width="100%" height="100%" style={{ display: 'block' }}>
          {/* ── Candle panel ── */}
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Highlight rect — Option B: repositioned via setAttribute, no redraw */}
            <rect
              ref={highlightRectRef}
              x={0}
              y={0}
              width={0}
              height={candleH}
              fill="var(--text-2)"
              fillOpacity={0.08}
              pointerEvents="none"
              visibility="hidden"
            />

            {/* Vertical crosshair for hovered candle */}
            <line
              ref={crosshairXRef}
              x1={0} x2={0}
              y1={0} y2={candleH}
              stroke="var(--text-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.5}
              visibility="hidden"
              pointerEvents="none"
            />

            {/* Candle bodies and wicks */}
            <g ref={candleGRef} />

            {/* X axis at bottom of candle panel */}
            <g ref={xAxisRef} transform={`translate(0,${candleH})`} />

            {/* Y axis (price) */}
            <g ref={yAxisRef} />

            {/* Invisible mouse-capture rect spanning the candle panel */}
            <rect
              x={0}
              y={0}
              width={innerW}
              height={candleH}
              fill="transparent"
              style={{ cursor: 'crosshair' }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          </g>

          {/* ── Volume panel ── */}
          <g transform={`translate(${MARGIN.left},${MARGIN.top + volPanelY})`}>
            <g ref={volGRef} />
            <g ref={volAxisRef} />
            {/* Brush group */}
            <g ref={brushGRef} />
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
