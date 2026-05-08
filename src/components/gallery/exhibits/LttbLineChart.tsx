import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { GalleryFrame } from '../GalleryFrame'
import { lttb, type Point } from '../lttb'
import { mulberry32 } from '../rng'

// ─── Constants ─────────────────────────────────────────────────────────────
const TOTAL_POINTS = 500_000
const SEED = 1337
const MARGIN = { top: 12, right: 20, bottom: 32, left: 52 } as const

// ─── Data generation ───────────────────────────────────────────────────────
// Generated inside useMemo so it runs once after first render rather than at
// module evaluation time. Module-level generation would block the main thread
// during initial parse, delaying the entire app's first paint.

function generatePriceWalk(): Point[] {
  const rng = mulberry32(SEED)
  const data: Point[] = new Array(TOTAL_POINTS)
  let price = 100

  for (let i = 0; i < TOTAL_POINTS; i++) {
    price += (rng() - 0.5) * 0.3
    if (price < 10)  price = 10
    if (price > 500) price = 500
    data[i] = { x: i, y: price }
  }

  return data
}

// ─── Tooltip state ─────────────────────────────────────────────────────────

interface TooltipState {
  x: number   // pixel position relative to the chart container div
  y: number
  point: Point
}

// ─── Component ─────────────────────────────────────────────────────────────

export function LttbLineChart() {
  const svgRef        = useRef<SVGSVGElement>(null)
  const containerRef  = useRef<HTMLDivElement>(null)
  const xAxisRef      = useRef<SVGGElement>(null)
  const yAxisRef      = useRef<SVGGElement>(null)
  const pathRef       = useRef<SVGPathElement>(null)
  const clipRectRef   = useRef<SVGRectElement>(null)
  // Crosshair lines — updated via setAttribute (no React state)
  const crosshairXRef = useRef<SVGLineElement>(null)
  const crosshairYRef = useRef<SVGLineElement>(null)
  const crosshairDotRef = useRef<SVGCircleElement>(null)

  // innerW is read from the container via ResizeObserver, NOT from the SVG
  // getBoundingClientRect. We cache it in a ref AND in state:
  // - ref: for use inside zoom handlers (avoids stale closure captures)
  // - state: triggers re-derivation of LTTB threshold when the window resizes
  const innerWRef = useRef(800)
  const [innerW, setInnerW] = useState(800)
  const [innerH, setInnerH] = useState(436) // 480 - 12 - 32

  const [useLttb, setUseLttb] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  // D3 zoom transform stored in a ref — we do NOT put this in React state
  // because zoom fires many times per second and triggering re-renders on each
  // frame would cause jank. Instead the zoom handler directly mutates the DOM
  // via d3 selections and only stores the transform so LTTB can re-bucket on
  // zoom end.
  const zoomTransformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity)

  // Base scales — defined once, never mutated. Zoomed variants are derived by
  // calling transform.rescaleX(xScaleBase) inside the zoom handler.
  const xScaleBase = useRef<d3.ScaleLinear<number, number>>(
    d3.scaleLinear().domain([0, TOTAL_POINTS - 1]).range([0, innerWRef.current])
  )

  // We need the current yScale inside the mousemove handler. Cache it in a ref
  // so the handler always reads the most recent version without stale closures.
  const yScaleRef = useRef<d3.ScaleLinear<number, number>>(d3.scaleLinear())

  // ─── Raw data (generated once) ──────────────────────────────────────────
  const rawData = useMemo<Point[]>(() => generatePriceWalk(), [])

  // ─── Displayed data (LTTB-downsampled for current view) ─────────────────
  // threshold is proportional to pixel width so we never draw more points
  // than the screen can resolve. 1.5× oversampling ensures no aliasing on
  // retina displays.
  const threshold = useLttb
    ? Math.max(200, Math.round(innerW * 1.5))
    : rawData.length

  const displayed = useMemo<Point[]>(
    () => lttb(rawData, threshold),
    [rawData, threshold]
    // Note: we intentionally do NOT include zoomTransformRef here. After a
    // zoom ends, we call the rebucket function directly (see onZoomEnd below).
  )

  // Track displayed separately as a ref so the zoom end handler can read it
  // without creating a stale closure — the effect below keeps it in sync.
  const displayedRef = useRef<Point[]>(displayed)
  useEffect(() => { displayedRef.current = displayed }, [displayed])

  // ─── ResizeObserver ─────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const w = rect.width
      const h = rect.height
      innerWRef.current = w - MARGIN.left - MARGIN.right
      setInnerW(innerWRef.current)
      setInnerH(h - MARGIN.top - MARGIN.bottom)
      // Update clip rect immediately without waiting for a re-render
      if (clipRectRef.current) {
        clipRectRef.current.setAttribute('width', String(innerWRef.current))
        clipRectRef.current.setAttribute('height', String(h - MARGIN.top - MARGIN.bottom))
      }
    })

    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── D3 render ──────────────────────────────────────────────────────────
  // This effect owns all DOM mutations: scales, axes, path. It runs when
  // displayed data or dimensions change. Zoom transform mutations happen
  // directly in the zoom handler and do NOT go through React state.

  const render = useCallback(() => {
    const svg = svgRef.current
    if (!svg) return

    const w = innerWRef.current
    const h = innerH

    // Update base x scale range to match current container width
    xScaleBase.current = xScaleBase.current.copy().range([0, w])

    // Apply the current zoom transform to get the visible x scale
    const xScale = zoomTransformRef.current.rescaleX(xScaleBase.current)

    // Compute y domain from the currently displayed slice
    // (LTTB already picked the most representative points)
    const yExt = d3.extent(displayedRef.current, d => d.y) as [number, number]
    const yPad = (yExt[1] - yExt[0]) * 0.05
    const yScale = d3
      .scaleLinear()
      .domain([yExt[0] - yPad, yExt[1] + yPad])
      .range([h, 0])

    // Cache the latest yScale so the mousemove handler can use it
    yScaleRef.current = yScale

    // ── Axes ──
    // We use d3.select<SVGGElement, unknown>() to satisfy D3's .call(axis) overload.
    // The null check above the block ensures the ref is mounted.
    if (xAxisRef.current) {
      const xSel = d3.select<SVGGElement, unknown>(xAxisRef.current)
      xSel.call(
        d3
          .axisBottom(xScale)
          .ticks(5)
          .tickFormat(d => {
            const v = +d
            return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          })
          .tickSize(4)
      )
      xSel.select('.domain').attr('stroke', 'var(--border)')
      xSel.selectAll('.tick line').attr('stroke', 'var(--border)')
      xSel.selectAll('.tick text')
        .attr('fill', 'var(--text-2)')
        .attr('font-size', 10)
        .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
    }

    if (yAxisRef.current) {
      const ySel = d3.select<SVGGElement, unknown>(yAxisRef.current)
      ySel.call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat(d => `$${(+d).toFixed(0)}`)
          .tickSize(4)
      )
      ySel.select('.domain').attr('stroke', 'var(--border)')
      ySel.selectAll('.tick line').attr('stroke', 'var(--border)')
      ySel.selectAll('.tick text')
        .attr('fill', 'var(--text-2)')
        .attr('font-size', 10)
        .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
    }

    // ── Line path ──
    const lineGen = d3
      .line<Point>()
      .x(d => xScale(d.x))
      .y(d => yScale(d.y))
      .curve(d3.curveMonotoneX)

    if (pathRef.current) {
      pathRef.current.setAttribute('d', lineGen(displayedRef.current) ?? '')
    }
  }, [innerH])

  // Full render on data or dimension change
  useEffect(() => {
    render()
  }, [render, displayed, innerW, innerH])

  // ─── Zoom setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 5000])
      .translateExtent([[0, 0], [TOTAL_POINTS, Infinity]])
      .filter((event: Event) => {
        // Allow wheel zoom and drag; block double-click which interferes with button clicks
        if (event.type === 'dblclick') return false
        return true
      })
      .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
        // Store transform for later use
        zoomTransformRef.current = event.transform

        // Immediately recompute x scale and update axes + path
        // We do NOT call setDisplayed here — that would trigger a React re-render
        // on every animation frame, killing performance.
        render()
      })
      .on('end', () => {
        // On zoom end: re-bucket via LTTB for the newly visible region.
        // We compute the visible domain from the current transform and filter
        // rawData to just the visible range before downsampling — this means
        // LTTB adapts its bucket size to the zoom level, so detail emerges as
        // you zoom in (exactly the "adaptive rebucket" behaviour described in
        // the GalleryFrame description).
        //
        // We trigger this by calling setUseLttb identity toggle — actually we
        // want to force a re-memo of displayed. The cleanest way is to change a
        // dep that useMemo watches. We keep a separate zoom-epoch counter.
        setZoomEpoch(e => e + 1)
      })

    d3.select(svg).call(zoom)

    return () => {
      d3.select(svg).on('.zoom', null)
    }
  }, [render])

  // zoomEpoch: incrementing this forces useMemo(displayed) to rerun after zoom ends
  const [zoomEpoch, setZoomEpoch] = useState(0)

  // Visible-range-aware LTTB re-bucket on zoom end
  const displayedZoomed = useMemo<Point[]>(() => {
    if (!useLttb) return rawData

    // Determine visible x domain from the current zoom transform + base scale
    const xVis = zoomTransformRef.current.rescaleX(xScaleBase.current)
    const [xMin, xMax] = xVis.domain()

    // Filter to visible points (with a 5% margin so partially-visible paths
    // don't clip at the edge)
    const margin = (xMax - xMin) * 0.05
    const visible = rawData.filter(p => p.x >= xMin - margin && p.x <= xMax + margin)

    const thr = Math.max(200, Math.round(innerWRef.current * 1.5))
    return lttb(visible.length > 0 ? visible : rawData, thr)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawData, useLttb, zoomEpoch, innerW])

  // Keep displayedRef in sync with the zoom-aware version
  useEffect(() => {
    displayedRef.current = displayedZoomed
    render()
  }, [displayedZoomed, render])

  // ─── Crosshair + tooltip ─────────────────────────────────────────────────
  // Mouse move is a user-paced event (not rAF), so a setState for the JSX
  // tooltip bubble is fine. The crosshair lines are updated via setAttribute
  // to avoid any React reconciliation overhead on the SVG lines themselves.
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGRectElement>) => {
    const svg = svgRef.current
    if (!svg) return

    const svgRect = svg.getBoundingClientRect()
    // plotX/plotY are relative to the plot area origin (inside margins)
    const plotX = e.clientX - svgRect.left - MARGIN.left
    const plotY = e.clientY - svgRect.top  - MARGIN.top

    // Clamp to plot bounds
    if (plotX < 0 || plotX > innerWRef.current) return

    // Map pixel → data x using current zoom-rescaled base scale
    const xScale = zoomTransformRef.current.rescaleX(xScaleBase.current)
    const dataX = xScale.invert(plotX)

    // Bisect the displayed (downsampled) array to find the nearest point
    const bisect = d3.bisector<Point, number>(d => d.x).left
    const idx = bisect(displayedRef.current, dataX, 1)
    const a = displayedRef.current[idx - 1]
    const b = displayedRef.current[idx]
    if (!a) return
    const nearestPoint = b && Math.abs(b.x - dataX) < Math.abs(a.x - dataX) ? b : a

    const px = xScale(nearestPoint.x)
    const py = yScaleRef.current(nearestPoint.y)

    // Update crosshair via direct DOM — no setState here
    if (crosshairXRef.current) {
      crosshairXRef.current.setAttribute('x1', String(px))
      crosshairXRef.current.setAttribute('x2', String(px))
      crosshairXRef.current.setAttribute('visibility', 'visible')
    }
    if (crosshairYRef.current) {
      crosshairYRef.current.setAttribute('y1', String(py))
      crosshairYRef.current.setAttribute('y2', String(py))
      crosshairYRef.current.setAttribute('visibility', 'visible')
    }
    if (crosshairDotRef.current) {
      crosshairDotRef.current.setAttribute('cx', String(px))
      crosshairDotRef.current.setAttribute('cy', String(py))
      crosshairDotRef.current.setAttribute('visibility', 'visible')
    }

    // Tooltip bubble position relative to the container div
    setTooltip({
      x: plotX + MARGIN.left,
      y: plotY + MARGIN.top,
      point: nearestPoint,
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (crosshairXRef.current)   crosshairXRef.current.setAttribute('visibility', 'hidden')
    if (crosshairYRef.current)   crosshairYRef.current.setAttribute('visibility', 'hidden')
    if (crosshairDotRef.current) crosshairDotRef.current.setAttribute('visibility', 'hidden')
    setTooltip(null)
  }, [])

  // ─── JSX ────────────────────────────────────────────────────────────────

  return (
    <GalleryFrame
      title="LTTB Line Chart"
      intro="Hover to inspect individual ticks. Scroll to zoom — LTTB rebuckets automatically so detail emerges as the window narrows."
      description="Largest-Triangle-Three-Buckets downsampling renders 500,000 price ticks at interactive frame rates. Zoom in to see LTTB adaptively rebucket — detail emerges as the visible window narrows."
      totalPoints={TOTAL_POINTS}
      renderedPoints={displayedZoomed.length}
      algorithm="LTTB"
      height={480}
    >
      {/* Container div — ResizeObserver target */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Toggle button — absolute positioned in top-right of chart area */}
        <button
          onClick={() => setUseLttb(v => !v)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            background: 'none',
            border: '1px solid var(--border)',
            color: 'var(--text-2)',
            fontSize: 11,
            padding: '3px 8px',
            cursor: 'pointer',
            borderRadius: 3,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '-0.01em',
          }}
        >
          {useLttb ? 'Show raw (may lag)' : 'Enable LTTB'}
        </button>

        {/* JSX tooltip bubble — positioned relative to container */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              // Flip to the left when close to the right edge
              left: tooltip.x + 120 > innerWRef.current + MARGIN.left
                ? tooltip.x - 118
                : tooltip.x + 12,
              top: tooltip.y - 28,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              padding: '4px 8px',
              pointerEvents: 'none',
              zIndex: 20,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11,
                color: 'var(--text-1)',
                letterSpacing: '-0.01em',
              }}
            >
              tick {tooltip.point.x.toLocaleString()} &middot; ${tooltip.point.y.toFixed(2)}
            </span>
          </div>
        )}

        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block', cursor: 'crosshair' }}
        >
          <defs>
            <clipPath id="clip-lttb">
              <rect
                ref={clipRectRef}
                x={0}
                y={0}
                width={innerW}
                height={innerH}
              />
            </clipPath>
          </defs>

          {/* Main plot group — offset by margins */}
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {/* Grid lines (subtle) */}
            <line
              x1={0} y1={0} x2={innerW} y2={0}
              stroke="var(--border)" strokeWidth={1} opacity={0.5}
            />
            <line
              x1={0} y1={innerH} x2={innerW} y2={innerH}
              stroke="var(--border)" strokeWidth={1} opacity={0.5}
            />

            {/* Price line — clipped so it doesn't overflow the plot area */}
            <path
              ref={pathRef}
              clipPath="url(#clip-lttb)"
              fill="none"
              stroke="var(--accent)"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />

            {/* X axis — rendered at bottom of plot area */}
            <g
              ref={xAxisRef}
              transform={`translate(0,${innerH})`}
            />

            {/* Y axis */}
            <g ref={yAxisRef} />

            {/* Crosshair — hidden until mouse enters; updated via setAttribute */}
            <line
              ref={crosshairXRef}
              x1={0} x2={0}
              y1={0} y2={innerH}
              stroke="var(--text-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
              visibility="hidden"
              pointerEvents="none"
              clipPath="url(#clip-lttb)"
            />
            <line
              ref={crosshairYRef}
              x1={0} x2={innerW}
              y1={0} y2={0}
              stroke="var(--text-2)"
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.6}
              visibility="hidden"
              pointerEvents="none"
            />
            <circle
              ref={crosshairDotRef}
              r={4}
              fill="var(--accent)"
              stroke="var(--bg)"
              strokeWidth={1.5}
              visibility="hidden"
              pointerEvents="none"
            />

            {/* Invisible mouse capture rect — sits on top of everything */}
            <rect
              x={0}
              y={0}
              width={innerW}
              height={innerH}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          </g>
        </svg>
      </div>
    </GalleryFrame>
  )
}
