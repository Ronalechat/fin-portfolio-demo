# Performance Fix Notes

## 1. ParallelCoordinates — Hover lag
ROOT CAUSE: 5,000 SVG `<path>` elements with `pointer-events: 'stroke'`.
The browser hit-tests all 5,000 stroke paths on every mousemove. SVG stroke
hit-testing is expensive — each path is a bezier curve the browser must
evaluate geometrically. The FILTER EFFECT also runs `.attr('stroke-opacity')`
on 5,000 elements = 5,000 DOM mutations.

FIX: Move lines to Canvas (2D context). Keep axes + brushes on SVG overlay.
- Canvas `drawLines(ctx, rows, brushExtents, yScales, xScale)` draws all lines
  in a single raster pass — no DOM nodes for lines at all
- Hover: on canvas mousemove, compute which axis-pair the cursor is between,
  then scan active rows to find nearest polyline (O(N) but no DOM, just math)
- Filter effect: call `drawLines()` directly — no per-path DOM updates

## 2. CrossfilterScatter — Slow dragging
ROOT CAUSE: brush handler uses `'brush end'` (fires on EVERY pixel during drag).
Each pixel: setBrushT/setBrushV setState → React re-render → isActive useMemo
(20k iterations) → drawCanvases callback → useEffect redraws both canvases →
sector bar useEffect redraws too. Could be 100+ React cycles per drag.

FIX: Separate 'brush' from 'end' handlers.
- 'brush' (live drag): update refs only + call drawScatterCanvas directly
  (no setState, no React cycle). Throttle with rAF.
- 'end': update state (filteredCount for chip) + redraw sector bar once

## 3. Workbench crash
ROOT CAUSE (most likely): ~30 Sparkline components mount simultaneously on
route load. Each Sparkline runs a useEffect that clears SVG DOM, computes D3
scales, runs d3.area/d3.line, and appends two paths. 30×(clear+scales+2paths)
is 120+ synchronous D3 DOM operations during React commit — accumulates to
200-500ms main thread block, perceived as crash/freeze.

SECONDARY: Both useChartData AND usePerformanceData iterate portfolioData on
mount (5k positions × trades each = ~40k total iterations, synchronous in render).

FIX:
A) Replace Sparkline D3 useEffect with direct SVG path string computation
   in render — no DOM clearing, no D3 scale objects, just math.
   path = `M x0,y0 L x1,y1 ...` computed from 2-6 points. Trivial.
B) Move filteredIds inner Date construction: `new Date(trade.date)` runs for
   every trade in filteredIds useMemo. Pre-parse dates at generation time
   if needed (low priority, already fast).
C) DataTable: the `table.getRowModel().rows` call with 5k rows + TanStack
   sort/filter model — ensure no unnecessary sorts fire on mount.

## 4. Workbench freeze — hover-induced DataTable re-renders
ROOT CAUSE: ChartTableView has `hoveredTicker` state that changes on every
`mouseenter`/`mouseleave` event (~60x/sec during fast scrolling). Without memo,
this caused a cascade:
  setHoveredTicker → ChartTableView re-render → DataTable re-renders
  (not memoized) → useReactTable(5k rows) + useVirtualizer(5k count) run
  → estimateSize (inline fn, new ref each render) causes TanStack Virtual to
  re-estimate all 5,000 rows → ~5-10ms per hover event → visible freeze.

FIX:
A) React.memo on DataTable — only re-renders when its actual props change.
B) useCallback on handleTradeSelect in ChartTableView — stable prop reference
   so memo can bail out correctly.
C) useMemo on positionCount in ChartTableView — 5,000-item filter ran on
   every render before.
D) useCallback on estimateSize in DataTable — stable reference stops TanStack
   Virtual from re-estimating all 5,000 rows on every parent re-render.

## 5. Workbench freeze — stale initial width causing 3-4 chart SVG builds
ROOT CAUSE: PortfolioChart.tsx initialises `width` state at 800 (arbitrary).
On mount: Activity tab useEffect builds SVG at width=800. ResizeObserver fires →
setWidth(actual) → re-render → effect runs AGAIN with correct width. In
StrictMode (dev) this multiplied to 3-4 full SVG builds per mount. Each build
calls root.selectAll('*').remove() + creates ~20 SVG elements + starts 6
D3 transitions.

FIX: Add useLayoutEffect (runs synchronously before paint) to read the
container's actual width before the first useEffect fires. Now the first
Activity tab SVG build already uses the correct dimensions → 1 build in
production, 2 in StrictMode development.

## Key Files
- src/components/gallery/exhibits/ParallelCoordinates.tsx (lines canvas rewrite)
- src/components/gallery/exhibits/CrossfilterScatter.tsx (brush 'brush' vs 'end')
- src/components/DataTable/Sparkline.tsx (remove D3, pure SVG path strings)
- src/components/PortfolioChart/PortfolioChart.tsx (area chart already done)
