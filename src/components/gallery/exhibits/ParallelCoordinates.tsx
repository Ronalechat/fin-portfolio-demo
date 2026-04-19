import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { GalleryFrame } from '../GalleryFrame'
import { portfolioData, TOTAL_PORTFOLIO_VALUE } from '../../../data/generateData'

// ─── Constants ─────────────────────────────────────────────────────────────

const SLICE_SIZE = 5_000
const MARGIN = { top: 40, right: 40, bottom: 20, left: 40 } as const

interface AxisDef {
  key: keyof Row
  label: string
  fmt: (v: number) => string
}

const AXES: AxisDef[] = [
  { key: 'pnlPercent',   label: 'P&L %',      fmt: v => v.toFixed(1) + '%' },
  { key: 'weight',       label: 'Weight',      fmt: v => v.toFixed(2) + '%' },
  { key: 'avgCost',      label: 'Avg Cost',    fmt: v => '$' + v.toFixed(0) },
  { key: 'currentPrice', label: 'Curr Price',  fmt: v => '$' + v.toFixed(0) },
  { key: 'tradeCount',   label: 'Trades',      fmt: v => v.toFixed(0) },
  { key: 'quantity',     label: 'Qty',         fmt: v => v.toLocaleString() },
]

const AXIS_KEYS = AXES.map(a => a.key) as (keyof Row)[]

// ─── Types ─────────────────────────────────────────────────────────────────

interface Row {
  id: number
  pnlPercent: number
  weight: number
  avgCost: number
  currentPrice: number
  tradeCount: number
  quantity: number
  pnlDollar: number
}

interface LineTooltipState {
  containerX: number
  containerY: number
  row: Row
}

// ─── Data preparation ──────────────────────────────────────────────────────

function buildRows(): Row[] {
  return portfolioData.slice(0, SLICE_SIZE).map(pos => ({
    id: pos.id,
    pnlPercent: pos.pnlPercent,
    weight: (pos.currentPrice * pos.quantity) / TOTAL_PORTFOLIO_VALUE * 100,
    avgCost: pos.avgCost,
    currentPrice: pos.currentPrice,
    tradeCount: pos.trades.length,
    quantity: pos.quantity,
    pnlDollar: pos.pnlDollar,
  }))
}

// ─── Canvas drawing ────────────────────────────────────────────────────────
// Draws all lines onto a single canvas context. No SVG hit-testing —
// eliminates the main perf bottleneck (browser stroke hit-test on 5k paths).

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  rows: Row[],
  xScale: d3.ScalePoint<string>,
  yScales: Partial<Record<keyof Row, d3.ScaleLinear<number, number>>>,
  brushExtents: Partial<Record<keyof Row, [number, number] | null>>,
  hoveredId: number | null,
  width: number,
  height: number,
  zk: number = 1,
  zx: number = 0,
) {
  ctx.clearRect(0, 0, width, height)

  // Transform base axis x positions using zoom (scale then translate)
  const xPositions = AXIS_KEYS.map(k => (xScale(k as string) ?? 0) * zk + zx)

  for (const row of rows) {
    // Check if row passes all brush filters
    let passes = true
    for (const { key } of AXES) {
      const ext = brushExtents[key]
      if (ext !== null && ext !== undefined) {
        const ys = yScales[key]
        if (!ys) continue
        const py = ys(row[key] as number)
        if (py < ext[0] || py > ext[1]) { passes = false; break }
      }
    }

    const isHovered = row.id === hoveredId
    const isPositive = row.pnlDollar >= 0

    if (isHovered) continue // draw hovered row last (on top)

    ctx.beginPath()
    for (let i = 0; i < AXIS_KEYS.length; i++) {
      const key = AXIS_KEYS[i]!
      const ys = yScales[key]
      if (!ys) continue
      const x = xPositions[i]!
      const y = ys(row[key] as number)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }

    if (passes) {
      ctx.strokeStyle = isPositive ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'
      ctx.lineWidth = 0.8
    } else {
      ctx.strokeStyle = 'rgba(120,120,128,0.04)'
      ctx.lineWidth = 0.5
    }
    ctx.stroke()
  }

  // Draw hovered row on top at full opacity
  if (hoveredId !== null) {
    const hRow = rows.find(r => r.id === hoveredId)
    if (hRow) {
      ctx.beginPath()
      for (let i = 0; i < AXIS_KEYS.length; i++) {
        const key = AXIS_KEYS[i]!
        const ys = yScales[key]
        if (!ys) continue
        const x = xPositions[i]!
        const y = ys(hRow[key] as number)
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.strokeStyle = hRow.pnlDollar >= 0 ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)'
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }
}

// ─── Hover detection ───────────────────────────────────────────────────────
// Given a canvas mouse position, find the nearest active (passing filter) row.
// Approach: find which axis-pair the mouse x falls between, interpolate each
// row's y at that x, return the row whose interpolated y is closest to mouse y.

function findNearestRow(
  canvasX: number,
  canvasY: number,
  rows: Row[],
  xScale: d3.ScalePoint<string>,
  yScales: Partial<Record<keyof Row, d3.ScaleLinear<number, number>>>,
  brushExtents: Partial<Record<keyof Row, [number, number] | null>>,
  threshold: number = 8,
  zk: number = 1,
  zx: number = 0,
): Row | null {
  const xPositions = AXIS_KEYS.map(k => (xScale(k as string) ?? 0) * zk + zx)

  // Find which segment the mouse x falls in
  let segIdx = -1
  for (let i = 0; i < xPositions.length - 1; i++) {
    if (canvasX >= xPositions[i]! && canvasX <= xPositions[i + 1]!) {
      segIdx = i
      break
    }
  }
  if (segIdx === -1) return null

  const x0 = xPositions[segIdx]!
  const x1 = xPositions[segIdx + 1]!
  const t = (canvasX - x0) / (x1 - x0)  // [0,1] interpolation fraction

  const key0 = AXIS_KEYS[segIdx]!
  const key1 = AXIS_KEYS[segIdx + 1]!
  const ys0 = yScales[key0]
  const ys1 = yScales[key1]
  if (!ys0 || !ys1) return null

  let bestRow: Row | null = null
  let bestDist = threshold

  for (const row of rows) {
    // Only hover-detectable if passing filters
    let passes = true
    for (const { key } of AXES) {
      const ext = brushExtents[key]
      if (ext !== null && ext !== undefined) {
        const ys = yScales[key]
        if (!ys) continue
        const py = ys(row[key] as number)
        if (py < ext[0] || py > ext[1]) { passes = false; break }
      }
    }
    if (!passes) continue

    const y0 = ys0(row[key0] as number)
    const y1 = ys1(row[key1] as number)
    const interpY = y0 + t * (y1 - y0)
    const dist = Math.abs(canvasY - interpY)
    if (dist < bestDist) {
      bestDist = dist
      bestRow = row
    }
  }

  return bestRow
}

// ─── Axis helper ───────────────────────────────────────────────────────────

function styleAxis(el: SVGGElement | null) {
  if (!el) return
  d3.select(el).select('.domain').attr('stroke', 'var(--border)')
  d3.select(el).selectAll('.tick line').attr('stroke', 'var(--border)')
  d3.select(el).selectAll('.tick text')
    .attr('fill', 'var(--text-2)')
    .attr('font-size', 9)
    .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ParallelCoordinates() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const svgRef        = useRef<SVGSVGElement>(null)

  const brushExtentsRef   = useRef<Partial<Record<keyof Row, [number, number] | null>>>({})
  const brushBehaviorsRef = useRef<Partial<Record<keyof Row, d3.BrushBehavior<unknown>>>>({})
  const brushGroupsRef    = useRef<Partial<Record<keyof Row, SVGGElement>>>({})
  const hoveredIdRef      = useRef<number | null>(null)
  // Zoom state: k = scale factor, x = translation offset. screenX = baseX * k + x
  const zoomRef           = useRef<{ k: number; x: number }>({ k: 1, x: 0 })

  const [innerW, setInnerW] = useState(720)
  const [innerH, setInnerH] = useState(420)
  const [brushExtents, setBrushExtents] = useState<Partial<Record<keyof Row, [number, number] | null>>>({})
  const [lineTooltip, setLineTooltip] = useState<LineTooltipState | null>(null)
  const [isZoomed, setIsZoomed] = useState(false)

  const rows = useMemo<Row[]>(() => buildRows(), [])

  const xScale = useMemo(
    () => d3.scalePoint<string>()
      .domain(AXIS_KEYS as string[])
      .range([0, innerW])
      .padding(0.15),
    [innerW]
  )

  const yScales = useMemo(() => {
    const scales: Partial<Record<keyof Row, d3.ScaleLinear<number, number>>> = {}
    for (const { key } of AXES) {
      const vals = rows.map(r => r[key] as number)
      const [lo, hi] = d3.extent(vals) as [number, number]
      const pad = (hi - lo) * 0.05 || 1
      scales[key] = d3.scaleLinear([lo - pad, hi + pad], [innerH, 0])
    }
    return scales
  }, [rows, innerH])

  const activeCount = useMemo(() => {
    let count = 0
    for (const row of rows) {
      let passes = true
      for (const { key } of AXES) {
        const ext = brushExtents[key]
        if (ext !== null && ext !== undefined) {
          const ys = yScales[key]
          if (!ys) continue
          const py = ys(row[key] as number)
          if (py < ext[0] || py > ext[1]) { passes = false; break }
        }
      }
      if (passes) count++
    }
    return count
  }, [rows, brushExtents, yScales])

  // ─── ResizeObserver ───────────────────────────────────────────────────────
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

  // ─── Canvas redraw ────────────────────────────────────────────────────────
  // Called directly (no React cycle) from brush handlers and hover.
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { k, x } = zoomRef.current
    drawCanvas(ctx, rows, xScale, yScales, brushExtentsRef.current, hoveredIdRef.current, innerW, innerH, k, x)
  }, [rows, xScale, yScales, innerW, innerH])

  // Resize canvas backing buffer + redraw when dimensions or scales change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = innerW
    canvas.height = innerH
    redrawCanvas()
  }, [redrawCanvas, innerW, innerH])

  // ─── SVG: axes + brushes ──────────────────────────────────────────────────
  // Only axes and brush handles live in SVG — no path elements.
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return
    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    // Reset zoom on resize/rebuild so axis positions are consistent
    zoomRef.current = { k: 1, x: 0 }
    setIsZoomed(false)

    brushBehaviorsRef.current = {}
    brushGroupsRef.current = {}

    const g = svg.append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    AXES.forEach(({ key, label }) => {
      const x = xScale(key as string) ?? 0
      const ys = yScales[key]
      if (!ys) return

      const axisG = g.append('g')
        .attr('class', `axis axis-${key}`)
        .attr('transform', `translate(${x},0)`)

      axisG.call(d3.axisLeft(ys).ticks(5))
      styleAxis(axisG.node() as SVGGElement | null)

      axisG.append('text')
        .attr('y', -20)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-2)')
        .attr('font-size', 10)
        .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
        .text(label)

      const brushG = axisG.append('g').attr('class', 'brush')

      const brush = d3.brushY()
        .extent([[-12, 0], [12, innerH]])
        .on('brush end', (event: d3.D3BrushEvent<unknown>) => {
          if (!event.sourceEvent) return
          const sel = event.selection as [number, number] | null
          brushExtentsRef.current = { ...brushExtentsRef.current, [key]: sel }
          // Redraw canvas directly — no setState, no React cycle
          redrawCanvas()
          // Commit to React state only on 'end' (updates count chip)
          if (event.type === 'end') {
            setBrushExtents(prev => ({ ...prev, [key]: sel }))
          }
        })

      brushG.call(brush)
      brushG.select('.selection')
        .attr('fill', 'var(--accent)').attr('fill-opacity', 0.2)
        .attr('stroke', 'var(--accent)').attr('stroke-width', 1)

      brushBehaviorsRef.current[key] = brush
      brushGroupsRef.current[key] = brushG.node()!
    })

  }, [rows, xScale, yScales, innerH, redrawCanvas])

  // ─── Canvas hover detection ───────────────────────────────────────────────
  // mousemove on canvas: geometric nearest-row lookup — no SVG hit-testing.
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = canvas.getBoundingClientRect()
    const canvasX = e.clientX - rect.left
    const canvasY = e.clientY - rect.top

    const { k, x: zx } = zoomRef.current
    const nearest = findNearestRow(canvasX, canvasY, rows, xScale, yScales, brushExtentsRef.current, 8, k, zx)

    if (nearest?.id !== hoveredIdRef.current) {
      hoveredIdRef.current = nearest?.id ?? null
      redrawCanvas()
    }

    if (nearest) {
      const containerRect = container.getBoundingClientRect()
      setLineTooltip({
        containerX: e.clientX - containerRect.left,
        containerY: e.clientY - containerRect.top,
        row: nearest,
      })
    } else {
      setLineTooltip(null)
    }
  }, [rows, xScale, yScales, redrawCanvas])

  const handleCanvasMouseLeave = useCallback(() => {
    hoveredIdRef.current = null
    redrawCanvas()
    setLineTooltip(null)
  }, [redrawCanvas])

  const hasBrush = Object.values(brushExtents).some(v => v !== null && v !== undefined)

  // ─── Scroll-to-zoom ───────────────────────────────────────────────────────
  // Attaches a wheel listener to the canvas. Zooms horizontally (x only),
  // centered on the cursor position — same UX as Exhibit 1 (LTTB line chart).
  // On each wheel event: update zoomRef, reposition SVG axis groups directly
  // (no React cycle), then redraw the canvas.
  useEffect(() => {
    const canvasEl = canvasRef.current
    const svgEl    = svgRef.current
    if (!canvasEl || !svgEl) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()

      const rect = canvasEl.getBoundingClientRect()
      const mouseX = e.clientX - rect.left  // cursor in canvas (inner) coords

      const { k: currentK, x: currentX } = zoomRef.current
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const newK   = Math.max(1, Math.min(8, currentK * factor))

      // Keep the point under the cursor stationary:
      //   mouseX = baseX * k + x  →  baseX = (mouseX - x) / k
      //   newX = mouseX - baseX * newK
      const newXUnclamped = mouseX - (mouseX - currentX) * (newK / currentK)

      // Clamp: leftmost axis can't scroll past x=0; rightmost stays visible
      const newX = Math.max(innerW * (1 - newK), Math.min(0, newXUnclamped))

      zoomRef.current = { k: newK, x: newX }
      setIsZoomed(newK !== 1 || newX !== 0)

      // Reposition SVG axis groups directly (no React re-render)
      const g = d3.select(svgEl).select<SVGGElement>('g')
      AXIS_KEYS.forEach(key => {
        const baseX = xScale(key as string) ?? 0
        g.select<SVGGElement>(`.axis-${key as string}`)
          .attr('transform', `translate(${baseX * newK + newX},0)`)
      })

      redrawCanvas()
    }

    canvasEl.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvasEl.removeEventListener('wheel', handleWheel)
  }, [xScale, innerW, redrawCanvas])

  // ─── Reset zoom ───────────────────────────────────────────────────────────
  const handleResetZoom = useCallback(() => {
    zoomRef.current = { k: 1, x: 0 }
    setIsZoomed(false)
    const svgEl = svgRef.current
    if (svgEl) {
      const g = d3.select(svgEl).select<SVGGElement>('g')
      AXIS_KEYS.forEach(key => {
        const baseX = xScale(key as string) ?? 0
        g.select<SVGGElement>(`.axis-${key as string}`)
          .attr('transform', `translate(${baseX},0)`)
      })
    }
    redrawCanvas()
  }, [xScale, redrawCanvas])

  const handleClearBrushes = useCallback(() => {
    setBrushExtents({})
    brushExtentsRef.current = {}
    for (const key of Object.keys(brushGroupsRef.current) as (keyof Row)[]) {
      const grpNode = brushGroupsRef.current[key]
      const bhv = brushBehaviorsRef.current[key]
      if (grpNode && bhv) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        d3.select(grpNode).call(bhv.move as any, null)
      }
    }
    redrawCanvas()
  }, [redrawCanvas])

  return (
    <GalleryFrame
      title="Parallel Coordinates"
      intro="Scroll to zoom. Brush any axis to filter. Hover an active line to inspect all six dimensions of that position."
      description="5,000 portfolio positions across 6 dimensions simultaneously — a view no table can provide. Lines on Canvas (no SVG hit-testing), axes and brushes on SVG overlay. Hover detection via geometric interpolation."
      totalPoints={SLICE_SIZE}
      renderedPoints={activeCount}
      height={520}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Control buttons — top-right corner */}
        <div style={{ position: 'absolute', top: 4, right: 8, zIndex: 10, display: 'flex', gap: 6 }}>
          {isZoomed && (
            <button
              onClick={handleResetZoom}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--accent)', fontSize: 10,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                cursor: 'pointer', padding: '2px 8px', letterSpacing: '0.04em',
              }}
            >
              reset zoom
            </button>
          )}
          {hasBrush && (
            <button
              onClick={handleClearBrushes}
              style={{
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--accent)', fontSize: 10,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                cursor: 'pointer', padding: '2px 8px', letterSpacing: '0.04em',
              }}
            >
              clear brushes
            </button>
          )}
        </div>
        {/* Scroll-to-zoom hint — bottom left, only when not zoomed */}
        {!isZoomed && (
          <div style={{
            position: 'absolute', bottom: 6, left: 8, zIndex: 10,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.04em', pointerEvents: 'none',
          }}>
            scroll to zoom
          </div>
        )}

        {/* Canvas — all 5,000 lines drawn here, no SVG paths */}
        <canvas
          ref={canvasRef}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={handleCanvasMouseLeave}
          style={{
            position: 'absolute',
            top: MARGIN.top,
            left: MARGIN.left,
            cursor: 'crosshair',
          }}
        />

        {/* SVG overlay — axes and brush handles only.
            SVG is pointer-events:none so canvas receives hover events;
            the brush <g> elements inside override this to 'all' via D3's
            brush internals (.overlay has pointer-events:all already). */}
        <svg
          ref={svgRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}
        >
          {/* D3 mutates brush groups directly — no React children needed */}
        </svg>

        {lineTooltip && (
          <div
            style={{
              position: 'absolute',
              left: lineTooltip.containerX + 12,
              top: lineTooltip.containerY - 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '5px 10px',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            {AXES.map(({ key, label, fmt }) => (
              <div key={key as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--text-2)' }}>
                  {label}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10,
                  color: key === 'pnlPercent'
                    ? (lineTooltip.row.pnlDollar >= 0 ? 'var(--positive)' : 'var(--negative)')
                    : 'var(--text-1)',
                }}>
                  {fmt(lineTooltip.row[key] as number)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </GalleryFrame>
  )
}
