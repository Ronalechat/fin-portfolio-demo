import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { GalleryFrame } from '../GalleryFrame'
import { mulberry32 } from '../rng'

// ─── Constants ─────────────────────────────────────────────────────────────

const TOTAL_POINTS = 20_000
const SEED = 13

const SCATTER_SECTORS = [
  'Tech', 'Finance', 'Energy', 'Health',
  'Consumer', 'Utilities', 'Materials', 'Industrials',
] as const

type ScatterSector = typeof SCATTER_SECTORS[number]

// Margin for each chart panel's axes
const MARGIN = { top: 12, right: 12, bottom: 36, left: 44 } as const
// Panel 3 (sector bar) needs a wider left margin so sector labels don't clip
const BAR_MARGIN_LEFT = 80

// ─── Types ─────────────────────────────────────────────────────────────────

interface TradeEvent {
  t: number       // [0, 1] normalised time index
  price: number   // [20, 500]
  volume: number  // [1, 100]
  sector: ScatterSector
}

interface BarTooltipState {
  containerX: number
  containerY: number
  sector: string
  count: number
  isSelected: boolean
}

// ─── Formatters ────────────────────────────────────────────────────────────

function fmtBar(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1_000)  return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Data generation ───────────────────────────────────────────────────────
// Random walk for price so the time-series panel shows something realistic.
// Volume is log-normal (heavy right tail) capped at 100 — mimics real trade sizes.
// Sector assignment is proportional but pseudo-random for variety.

function generateData(rng: () => number): TradeEvent[] {
  const data: TradeEvent[] = new Array(TOTAL_POINTS)
  let price = 150

  for (let i = 0; i < TOTAL_POINTS; i++) {
    // Random walk: small daily drift
    price += (rng() - 0.5) * 6
    if (price < 20)  price = 20
    if (price > 500) price = 500

    // Log-normal volume: exp(U[0,3] + 2) gives a right-skewed distribution
    const volume = Math.min(Math.exp(rng() * 3 + 2), 100)

    const sectorIdx = Math.floor(rng() * SCATTER_SECTORS.length)
    const sector = SCATTER_SECTORS[sectorIdx]

    data[i] = {
      t: i / (TOTAL_POINTS - 1),
      price,
      volume,
      sector,
    }
  }

  return data
}

// ─── Canvas drawing ────────────────────────────────────────────────────────
// We draw onto an HTML Canvas (2D API) rather than SVG circles for performance.
// SVG with 20,000 circle elements would thrash the DOM — canvas treats the
// whole plot as a flat bitmap, so drawing 20k points is a matter of pixel fills.

function drawScatterCanvas(
  ctx: CanvasRenderingContext2D,
  data: TradeEvent[],
  isActive: boolean[],
  xVal: (d: TradeEvent) => number,
  yVal: (d: TradeEvent) => number,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height)

  // Draw inactive points first (underneath), then active points on top.
  // Two passes avoid z-order artifacts where active points are hidden by later inactive ones.

  ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    if (isActive[i]) continue
    const px = xScale(xVal(data[i]))
    const py = yScale(yVal(data[i]))
    ctx.moveTo(px + 2, py)
    ctx.arc(px, py, 2, 0, Math.PI * 2)
  }
  ctx.fillStyle = 'rgba(136,136,144,0.08)'
  ctx.fill()

  ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    if (!isActive[i]) continue
    const px = xScale(xVal(data[i]))
    const py = yScale(yVal(data[i]))
    ctx.moveTo(px + 2, py)
    ctx.arc(px, py, 2, 0, Math.PI * 2)
  }
  ctx.fillStyle = 'rgba(196,127,0,0.6)'
  ctx.fill()
}

// ─── Axis helper ───────────────────────────────────────────────────────────

function styleAxis(el: SVGGElement | null) {
  if (!el) return
  d3.select(el).select('.domain').attr('stroke', 'var(--border)')
  d3.select(el).selectAll('.tick line').attr('stroke', 'var(--border)')
  d3.select(el).selectAll('.tick text')
    .attr('fill', 'var(--text-2)')
    .attr('font-size', 10)
    .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
}

// ─── Component ─────────────────────────────────────────────────────────────

export function CrossfilterScatter() {
  const containerRef = useRef<HTMLDivElement>(null)

  // Panel 1 — Time vs Price
  const canvas1Ref    = useRef<HTMLCanvasElement>(null)
  const svgOverlay1   = useRef<SVGSVGElement>(null)
  const xAxis1Ref     = useRef<SVGGElement>(null)
  const yAxis1Ref     = useRef<SVGGElement>(null)
  const brushG1Ref    = useRef<SVGGElement>(null)

  // Panel 2 — Volume vs Price
  const canvas2Ref    = useRef<HTMLCanvasElement>(null)
  const svgOverlay2   = useRef<SVGSVGElement>(null)
  const xAxis2Ref     = useRef<SVGGElement>(null)
  const yAxis2Ref     = useRef<SVGGElement>(null)
  const brushG2Ref    = useRef<SVGGElement>(null)

  // Panel 3 — Sector bar
  const svgBarRef     = useRef<SVGSVGElement>(null)
  const barGRef       = useRef<SVGGElement>(null)
  const barYAxisRef   = useRef<SVGGElement>(null)

  // Panel dimensions derived from ResizeObserver
  const [panelH,    setPanelH]    = useState(400)
  const [p1W,       setP1W]       = useState(400)
  const [p2W,       setP2W]       = useState(240)
  const [p3W,       setP3W]       = useState(160)

  // Filter state — brush extents in pixel space (null = no brush = all pass).
  // Refs hold the live values used in the hot-path canvas redraw (no React cycle).
  // State versions are only committed on 'end' to update the count chip.
  const brushTRef = useRef<[number, number] | null>(null)
  const brushVRef = useRef<[number, number] | null>(null)
  const [brushExtents, setBrushExtents] = useState<{
    time: [number, number] | null
    volume: [number, number] | null
  }>({ time: null, volume: null })
  const [selectedSectors, setSelectedSectors] = useState<Set<string>>(
    () => new Set(SCATTER_SECTORS)
  )
  const selectedSectorsRef = useRef<Set<string>>(new Set(SCATTER_SECTORS))
  const [barTooltip, setBarTooltip] = useState<BarTooltipState | null>(null)
  const rAFRef = useRef<number | null>(null)

  // ─── Data ──────────────────────────────────────────────────────────────────
  const data = useMemo<TradeEvent[]>(() => {
    const rng = mulberry32(SEED)
    return generateData(rng)
  }, [])

  // ─── Scales (memoised, rebuilt on panel size changes) ─────────────────────
  const p1InnerW = p1W - MARGIN.left - MARGIN.right
  const p1InnerH = panelH - MARGIN.top - MARGIN.bottom
  const p2InnerW = p2W - MARGIN.left - MARGIN.right
  const p2InnerH = panelH - MARGIN.top - MARGIN.bottom
  const p3InnerW = p3W - BAR_MARGIN_LEFT - MARGIN.right
  const p3InnerH = panelH - MARGIN.top - MARGIN.bottom

  const xScaleT = useMemo(
    () => d3.scaleLinear([0, 1], [0, p1InnerW]),
    [p1InnerW]
  )
  const yScalePrice1 = useMemo(
    () => d3.scaleLinear([20, 500], [p1InnerH, 0]),
    [p1InnerH]
  )
  const xScaleV = useMemo(
    () => d3.scaleLinear([0, 100], [0, p2InnerW]),
    [p2InnerW]
  )
  const yScalePrice2 = useMemo(
    () => d3.scaleLinear([20, 500], [p2InnerH, 0]),
    [p2InnerH]
  )

  // ─── Active point computation (ref-based, no React cycle) ───────────────────
  // Called directly from brush/sector handlers — bypasses React entirely.
  // Returns a flat boolean array for O(1) active lookup in drawScatterCanvas.
  const computeIsActive = useCallback((
    bT: [number, number] | null,
    bV: [number, number] | null,
    sectors: Set<string>,
    innerH: number,
  ): boolean[] => {
    const active = new Array<boolean>(data.length)
    let tLo = 0, tHi = 1
    if (bT !== null) {
      tLo = xScaleT.invert(bT[0])
      tHi = xScaleT.invert(bT[1])
    }
    let vLo = 0, vHi = 100
    if (bV !== null) {
      vLo = (100 * (innerH - bV[1])) / innerH
      vHi = (100 * (innerH - bV[0])) / innerH
      if (vLo > vHi) { const tmp = vLo; vLo = vHi; vHi = tmp }
    }
    for (let i = 0; i < data.length; i++) {
      const d = data[i]
      active[i] =
        (bT === null || (d.t >= tLo && d.t <= tHi)) &&
        (bV === null || (d.volume >= vLo && d.volume <= vHi)) &&
        sectors.has(d.sector)
    }
    return active
  }, [data, xScaleT])

  // isActive for initial render and sector toggle (React-driven, infrequent)
  const isActive = useMemo(
    () => computeIsActive(brushExtents.time, brushExtents.volume, selectedSectors, p2InnerH),
    [computeIsActive, brushExtents, selectedSectors, p2InnerH],
  )

  const activeCount = useMemo(() => {
    let count = 0
    for (let i = 0; i < isActive.length; i++) {
      if (isActive[i]) count++
    }
    return count
  }, [isActive])

  // ─── ResizeObserver ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = rect.width
      const h = rect.height
      setP1W(Math.floor(w * 0.47))
      setP2W(Math.floor(w * 0.28))
      setP3W(Math.floor(w * 0.25))
      setPanelH(h)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── Draw canvases ────────────────────────────────────────────────────────
  // We redraw both canvases any time the active filter or dimensions change.
  // Canvas 2D is a bitmap — no incremental update, always full repaint.
  // That's fine: 20k arc() calls take ~5ms on modern hardware.
  const drawCanvases = useCallback(() => {
    const c1 = canvas1Ref.current
    const c2 = canvas2Ref.current
    if (!c1 || !c2) return

    const ctx1 = c1.getContext('2d')
    const ctx2 = c2.getContext('2d')
    if (!ctx1 || !ctx2) return

    drawScatterCanvas(
      ctx1, data, isActive,
      d => d.t,      // X: time
      d => d.price,  // Y: price
      xScaleT, yScalePrice1,
      p1InnerW, p1InnerH,
    )

    // Panel 2: volume on X, price on Y — reuse yScalePrice2 (same domain)
    drawScatterCanvas(
      ctx2, data, isActive,
      d => d.volume, // X: volume
      d => d.price,  // Y: price
      xScaleV, yScalePrice2,
      p2InnerW, p2InnerH,
    )
  }, [data, isActive, xScaleT, yScalePrice1, xScaleV, yScalePrice2, p1InnerW, p1InnerH, p2InnerW, p2InnerH])

  useEffect(() => {
    // Resize canvas backing buffer to match CSS size (avoids blur on HiDPI)
    const c1 = canvas1Ref.current
    const c2 = canvas2Ref.current
    if (c1) { c1.width = p1InnerW; c1.height = p1InnerH }
    if (c2) { c2.width = p2InnerW; c2.height = p2InnerH }
    drawCanvases()
  }, [drawCanvases, p1InnerW, p1InnerH, p2InnerW, p2InnerH])

  // ─── Axes for panel 1 (Time vs Price) ────────────────────────────────────
  useEffect(() => {
    if (xAxis1Ref.current) {
      d3.select<SVGGElement, unknown>(xAxis1Ref.current).call(
        d3.axisBottom(xScaleT).ticks(5).tickFormat(d => `${Math.round(+d * 100)}%`)
      )
      styleAxis(xAxis1Ref.current)
    }
    if (yAxis1Ref.current) {
      d3.select<SVGGElement, unknown>(yAxis1Ref.current).call(
        d3.axisLeft(yScalePrice1).ticks(5).tickFormat(d => `$${+d}`)
      )
      styleAxis(yAxis1Ref.current)
    }
  }, [xScaleT, yScalePrice1])

  // ─── Axes for panel 2 (Volume vs Price) ───────────────────────────────────
  useEffect(() => {
    if (xAxis2Ref.current) {
      d3.select<SVGGElement, unknown>(xAxis2Ref.current).call(
        d3.axisBottom(xScaleV).ticks(4)
      )
      styleAxis(xAxis2Ref.current)
    }
    if (yAxis2Ref.current) {
      d3.select<SVGGElement, unknown>(yAxis2Ref.current).call(
        d3.axisLeft(yScalePrice2).ticks(5).tickFormat(d => `$${+d}`)
      )
      styleAxis(yAxis2Ref.current)
    }
  }, [xScaleV, yScalePrice2])

  // ─── brushX on panel 1 ───────────────────────────────────────────────────
  // 'brush' (live drag): update ref + schedule rAF canvas redraw — no setState.
  // 'end': update ref + setState for count chip (1 React cycle per drag, not 100+).
  useEffect(() => {
    const g = brushG1Ref.current
    if (!g) return

    const brush = d3.brushX()
      .extent([[0, 0], [p1InnerW, p1InnerH]])
      .on('brush', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.sourceEvent) return
        brushTRef.current = event.selection as [number, number] | null
        if (rAFRef.current !== null) cancelAnimationFrame(rAFRef.current)
        rAFRef.current = requestAnimationFrame(() => {
          const active = computeIsActive(brushTRef.current, brushVRef.current, selectedSectorsRef.current, p2InnerH)
          const c1 = canvas1Ref.current; const c2 = canvas2Ref.current
          if (c1) { const ctx = c1.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.t, d => d.price, xScaleT, yScalePrice1, p1InnerW, p1InnerH) }
          if (c2) { const ctx = c2.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.volume, d => d.price, xScaleV, yScalePrice2, p2InnerW, p2InnerH) }
        })
      })
      .on('end', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.sourceEvent) return
        brushTRef.current = event.selection as [number, number] | null
        const active = computeIsActive(brushTRef.current, brushVRef.current, selectedSectorsRef.current, p2InnerH)
        // Redraw on deselect (brush fires only during drag; end fires on click-to-clear)
        const c1 = canvas1Ref.current; const c2 = canvas2Ref.current
        if (c1) { const ctx = c1.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.t, d => d.price, xScaleT, yScalePrice1, p1InnerW, p1InnerH) }
        if (c2) { const ctx = c2.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.volume, d => d.price, xScaleV, yScalePrice2, p2InnerW, p2InnerH) }
        setBrushExtents(prev => ({ ...prev, time: brushTRef.current }))
      })

    d3.select<SVGGElement, unknown>(g).call(brush)
    d3.select(g).select('.selection')
      .attr('fill', 'var(--accent)').attr('fill-opacity', 0.12)
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1)
  }, [p1InnerW, p1InnerH, computeIsActive, data, xScaleT, yScalePrice1, xScaleV, yScalePrice2, p2InnerW, p2InnerH])

  // ─── brushY on panel 2 ───────────────────────────────────────────────────
  useEffect(() => {
    const g = brushG2Ref.current
    if (!g) return

    const brush = d3.brushY()
      .extent([[0, 0], [p2InnerW, p2InnerH]])
      .on('brush', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.sourceEvent) return
        brushVRef.current = event.selection as [number, number] | null
        if (rAFRef.current !== null) cancelAnimationFrame(rAFRef.current)
        rAFRef.current = requestAnimationFrame(() => {
          const active = computeIsActive(brushTRef.current, brushVRef.current, selectedSectorsRef.current, p2InnerH)
          const c1 = canvas1Ref.current; const c2 = canvas2Ref.current
          if (c1) { const ctx = c1.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.t, d => d.price, xScaleT, yScalePrice1, p1InnerW, p1InnerH) }
          if (c2) { const ctx = c2.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.volume, d => d.price, xScaleV, yScalePrice2, p2InnerW, p2InnerH) }
        })
      })
      .on('end', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.sourceEvent) return
        brushVRef.current = event.selection as [number, number] | null
        const active = computeIsActive(brushTRef.current, brushVRef.current, selectedSectorsRef.current, p2InnerH)
        // Redraw on deselect (brush fires only during drag; end fires on click-to-clear)
        const c1 = canvas1Ref.current; const c2 = canvas2Ref.current
        if (c1) { const ctx = c1.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.t, d => d.price, xScaleT, yScalePrice1, p1InnerW, p1InnerH) }
        if (c2) { const ctx = c2.getContext('2d'); if (ctx) drawScatterCanvas(ctx, data, active, d => d.volume, d => d.price, xScaleV, yScalePrice2, p2InnerW, p2InnerH) }
        setBrushExtents(prev => ({ ...prev, volume: brushVRef.current }))
      })

    d3.select<SVGGElement, unknown>(g).call(brush)
    d3.select(g).select('.selection')
      .attr('fill', 'var(--accent)').attr('fill-opacity', 0.12)
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1)
  }, [p2InnerW, p2InnerH, computeIsActive, data, xScaleT, yScalePrice1, xScaleV, yScalePrice2, p1InnerW, p1InnerH])

  // ─── Sector bar chart (panel 3) ───────────────────────────────────────────
  // Bar tooltip handlers — defined here so they can reference containerRef
  const handleBarMouseEnter = useCallback((
    e: MouseEvent,
    sector: string,
    count: number,
    isSelected: boolean,
  ) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    setBarTooltip({
      containerX: e.clientX - rect.left,
      containerY: e.clientY - rect.top,
      sector,
      count,
      isSelected,
    })
  }, [])

  const handleBarMouseLeave = useCallback(() => {
    setBarTooltip(null)
  }, [])

  useEffect(() => {
    const g = d3.select(barGRef.current)
    if (!g) return
    g.selectAll('*').remove()

    // Count active points per sector
    const counts: Record<string, number> = {}
    for (const s of SCATTER_SECTORS) counts[s] = 0
    for (let i = 0; i < data.length; i++) {
      if (isActive[i]) counts[data[i].sector]++
    }

    const maxCount = Math.max(...Object.values(counts), 1)

    const xBar = d3.scaleLinear([0, maxCount], [0, p3InnerW])
    const yBar = d3.scaleBand<string>()
      .domain(SCATTER_SECTORS as unknown as string[])
      .range([0, p3InnerH])
      .padding(0.25)

    // Bars
    SCATTER_SECTORS.forEach(sector => {
      const isSelected = selectedSectors.has(sector)
      const barH = yBar.bandwidth()
      const barY = yBar(sector) ?? 0
      const activeBarW = xBar(counts[sector])

      // Deselected sectors use full-width ghost bars so they remain clickable.
      // A zero-width rect has no hit area — the user can't re-enable the sector.
      const barW = isSelected ? activeBarW : p3InnerW

      const barEl = g.append('rect')
        .attr('x', 0)
        .attr('y', barY)
        .attr('width', barW)
        .attr('height', barH)
        .attr('fill', isSelected ? 'var(--accent)' : 'var(--text-2)')
        .attr('fill-opacity', isSelected ? 1 : 0.08)
        .style('cursor', 'pointer')

      // Dashed outline for deselected ghost bars
      if (!isSelected) {
        g.append('rect')
          .attr('x', 0)
          .attr('y', barY)
          .attr('width', p3InnerW)
          .attr('height', barH)
          .attr('fill', 'none')
          .attr('stroke', 'var(--text-2)')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3 2')
          .attr('opacity', 0.25)
          .style('pointer-events', 'none')
      }

      barEl
        .on('click', () => {
          setSelectedSectors(prev => {
            const next = new Set(prev)
            if (next.has(sector)) {
              next.delete(sector)
            } else {
              next.add(sector)
            }
            return next
          })
        })
        .on('mouseenter', (event: MouseEvent) => {
          handleBarMouseEnter(event, sector, counts[sector], isSelected)
        })
        .on('mouseleave', handleBarMouseLeave)

      // Count label — only for selected (active) bars
      // Cap x so label doesn't escape the inner width; abbreviate to save space
      if (isSelected && activeBarW > 0) {
        const labelX = Math.min(activeBarW + 3, p3InnerW - 2)
        g.append('text')
          .attr('x', labelX)
          .attr('y', barY + barH / 2)
          .attr('dy', '0.35em')
          .attr('font-size', 9)
          .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
          .attr('fill', 'var(--text-2)')
          .text(fmtBar(counts[sector]))
      }
    })

    // Y axis (sector names)
    if (barYAxisRef.current) {
      d3.select<SVGGElement, unknown>(barYAxisRef.current).call(
        d3.axisLeft(yBar).tickSize(0)
      )
      const sel = d3.select(barYAxisRef.current)
      sel.select('.domain').remove()
      sel.selectAll('.tick text')
        .attr('fill', 'var(--text-2)')
        .attr('font-size', 10)
        .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
        .attr('dx', -4)
    }

  }, [data, isActive, selectedSectors, p3InnerW, p3InnerH, handleBarMouseEnter, handleBarMouseLeave])

  // Keep selectedSectorsRef in sync so brush handlers can read current sectors
  useEffect(() => { selectedSectorsRef.current = selectedSectors }, [selectedSectors])

  // ─── Active filter annotation ─────────────────────────────────────────────
  // Shown in panel 1 when any filter is active
  const hasFilter = brushExtents.time !== null || brushExtents.volume !== null || selectedSectors.size < SCATTER_SECTORS.length
  const filterLabel = `${activeCount.toLocaleString()} / ${TOTAL_POINTS.toLocaleString()} pts`

  // ─── Toggle all sectors helper ────────────────────────────────────────────
  const allSelected = selectedSectors.size === SCATTER_SECTORS.length

  return (
    <GalleryFrame
      title="Crossfilter Scatter"
      intro="Brush the time or volume panel to filter all views simultaneously. Click a sector bar to toggle it. Active filters are annotated."
      description="20,000 trade events across 3 coordinated views. Brush the time or volume panel to filter all three simultaneously. Canvas 2D for performance — no setState in the filter hot path."
      totalPoints={TOTAL_POINTS}
      renderedPoints={activeCount}
      height={520}
    >
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}
      >
        {/* ── Panel 1: Time vs Price ── */}
        <div style={{ width: p1W, height: '100%', position: 'relative', flexShrink: 0 }}>
          {/* Canvas sits inside the margin inset */}
          <canvas
            ref={canvas1Ref}
            style={{
              position: 'absolute',
              top: MARGIN.top,
              left: MARGIN.left,
              width: p1InnerW,
              height: p1InnerH,
            }}
          />
          {/* SVG overlay for axes + brush */}
          <svg
            ref={svgOverlay1}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {/* Brush layer — on top of canvas, transparent fill */}
              <g ref={brushG1Ref} />
              {/* Axes */}
              <g ref={xAxis1Ref} transform={`translate(0,${p1InnerH})`} />
              <g ref={yAxis1Ref} />
              {/* Panel label */}
              <text
                x={p1InnerW / 2}
                y={-2}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-2)"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
              >
                Time vs Price
              </text>
              {/* Active filter annotation — shown when any filter is active */}
              {hasFilter && (
                <text
                  x={p1InnerW}
                  y={p1InnerH - 4}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--accent)"
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                >
                  {filterLabel} active
                </text>
              )}
            </g>
          </svg>
        </div>

        {/* ── Panel 2: Volume vs Price ── */}
        <div style={{ width: p2W, height: '100%', position: 'relative', flexShrink: 0 }}>
          <canvas
            ref={canvas2Ref}
            style={{
              position: 'absolute',
              top: MARGIN.top,
              left: MARGIN.left,
              width: p2InnerW,
              height: p2InnerH,
            }}
          />
          <svg
            ref={svgOverlay2}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              <g ref={brushG2Ref} />
              <g ref={xAxis2Ref} transform={`translate(0,${p2InnerH})`} />
              <g ref={yAxis2Ref} />
              <text
                x={p2InnerW / 2}
                y={-2}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-2)"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
              >
                Volume vs Price
              </text>
            </g>
          </svg>
        </div>

        {/* ── Panel 3: Sector bar ── */}
        <div style={{ flex: 1, height: '100%', position: 'relative' }}>
          <svg
            ref={svgBarRef}
            style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible' }}
          >
            <g transform={`translate(${BAR_MARGIN_LEFT},${MARGIN.top})`}>
              <g ref={barGRef} />
              <g ref={barYAxisRef} />
              {/* Reset link if not all selected */}
              {!allSelected && (
                <text
                  x={p3InnerW}
                  y={-4}
                  textAnchor="end"
                  fontSize={9}
                  fill="var(--accent)"
                  fontFamily="'JetBrains Mono', ui-monospace, monospace"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelectedSectors(new Set(SCATTER_SECTORS))}
                >
                  reset
                </text>
              )}
              <text
                x={p3InnerW / 2}
                y={-2}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-2)"
                fontFamily="'JetBrains Mono', ui-monospace, monospace"
              >
                Sector
              </text>
            </g>
          </svg>
        </div>

        {/* Bar tooltip — absolutely positioned over the container */}
        {barTooltip && (
          <div
            style={{
              position: 'absolute',
              left: barTooltip.containerX + 10,
              top: barTooltip.containerY - 48,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '4px 9px',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: 'var(--text-1)', fontWeight: 600 }}>
              {barTooltip.sector}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>
              {barTooltip.count.toLocaleString()} pts
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 9, color: barTooltip.isSelected ? 'var(--positive)' : 'var(--text-2)' }}>
              {barTooltip.isSelected ? 'selected — click to hide' : 'hidden — click to show'}
            </div>
          </div>
        )}
      </div>
    </GalleryFrame>
  )
}
