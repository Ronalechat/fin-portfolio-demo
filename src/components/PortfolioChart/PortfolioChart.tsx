import { useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { useChartData, PERIOD_OPTIONS } from './useChartData'
import { usePerformanceData } from './usePerformanceData'
import type { DayDatum } from './useChartData'
import { X } from '@phosphor-icons/react'
import type { Trade, Position } from '../../data/types'

export interface SelectedTrade {
  trade: Trade
  position: Position
}

type TabId = 'activity' | 'performance' | 'attribution'

interface Props {
  onBrush: (range: [Date, Date] | null) => void
  hasBrush: boolean
  selectedTrade: SelectedTrade | null
  periodDays: number
  onPeriodChange: (days: number) => void
  highlightedTicker: string | null        // 2C — dims non-matching bar stacks
  expandedPositionTrades: Trade[] | null  // 2D — tick marks for all trades of expanded position
}

interface TooltipState {
  x: number
  y: number
  date: Date
  values: { key: string; value: number }[]
}

const MARGIN = { top: 44, right: 20, bottom: 36, left: 72 }
// top=44 gives room for the tab + period row above the plot area

export function PortfolioChart({
  onBrush,
  hasBrush,
  selectedTrade,
  periodDays,
  onPeriodChange,
  highlightedTicker,
  expandedPositionTrades,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null)
  const brushGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const xScaleRef = useRef<d3.ScaleTime<number, number> | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [width, setWidth] = useState(800)
  const [activeTab, setActiveTab] = useState<TabId>('activity')

  const { days, keys, stackedData, colorScale, dayDataMap } = useChartData(periodDays)
  const { series: perfSeries, attribution } = usePerformanceData(periodDays)

  const height = 280
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

  const clearBrush = useCallback(() => {
    if (brushRef.current && brushGRef.current) {
      brushGRef.current.call(brushRef.current.clear)
    }
    onBrush(null)
  }, [onBrush])

  // ─── ResizeObserver ───────────────────────────────────────────────────────
  // useLayoutEffect reads the real width synchronously on mount so the first
  // render already has the correct dimensions. Without this the Activity tab
  // useEffect runs with width=800 (initial state) and then again after
  // ResizeObserver fires — two full SVG builds on every mount. In StrictMode
  // (dev) that multiplied to 3–4 builds. Now: one build with correct width.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (el) {
      const w = el.getBoundingClientRect().width
      if (w > 0) setWidth(w)
    }
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ─── Activity tab ─────────────────────────────────────────────────────────
  // Stacked area chart — 6 <path> elements (one per ticker layer) instead of
  // the previous bar chart (365 days × 6 tickers = 2,190 <rect> elements with
  // D3 transitions). Far fewer DOM nodes = no main-thread blocking.
  // D3: d3.scaleTime(), d3.stack(), d3.area(), curveMonotoneX, brushX, transition.
  useEffect(() => {
    if (activeTab !== 'activity') return
    const svg = svgRef.current
    if (!svg || innerW <= 0 || days.length < 2) return

    const root = d3.select(svg)
    root.selectAll('*').remove()

    const g = root
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    const xScale = d3.scaleTime()
      .domain([days[0], days[days.length - 1]])
      .range([0, innerW])

    xScaleRef.current = xScale

    const maxY = d3.max(stackedData[stackedData.length - 1], (d) => d[1]) ?? 0
    const yScale = d3.scaleLinear().domain([0, maxY * 1.05]).range([innerH, 0])

    // Grid
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(() => ''))
      .call((ax) => {
        ax.select('.domain').remove()
        ax.selectAll('line')
          .attr('stroke', 'var(--border)')
          .attr('stroke-dasharray', '2,4')
      })

    // Area generators — animate from flat baseline to actual values on enter
    const area = d3.area<d3.SeriesPoint<DayDatum>>()
      .x((d) => xScale((d.data as DayDatum).date as Date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX)

    const areaFlat = d3.area<d3.SeriesPoint<DayDatum>>()
      .x((d) => xScale((d.data as DayDatum).date as Date))
      .y0(() => yScale(0))
      .y1(() => yScale(0))
      .curve(d3.curveMonotoneX)

    g.selectAll('.layer')
      .data(stackedData)
      .join('g')
      .attr('class', 'layer')
      .attr('data-ticker', (d) => d.key)
      .append('path')
      .attr('fill', (d) => colorScale(d.key))
      .attr('fill-opacity', 0.8)
      .attr('d', areaFlat)
      .transition()
      .duration(350)
      .ease(d3.easeQuadOut)
      .attr('d', area)

    // X axis
    const xFmt = periodDays <= 180 ? d3.timeFormat('%b %d') : d3.timeFormat('%b %Y')
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat((d) => xFmt(d as Date)))
      .call((ax) => ax.select('.domain').remove())

    // Y axis
    g.append('g')
      .attr('class', 'axis')
      .call(
        d3.axisLeft(yScale).ticks(5).tickFormat((v) => {
          const n = v as number
          if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
          if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
          return `$${n}`
        }),
      )
      .call((ax) => ax.select('.domain').remove())

    // Bisector for O(log N) nearest-day lookup — used by hover and brush click
    const bisect = d3.bisector<Date, Date>((d) => d).left
    function nearestDay(pixelX: number): Date {
      const date = xScale.invert(pixelX)
      let i = bisect(days, date)
      if (i >= days.length) i = days.length - 1
      else if (i > 0) {
        const a = days[i - 1], b = days[i]
        if (Math.abs(a.getTime() - date.getTime()) < Math.abs(b.getTime() - date.getTime())) i = i - 1
      }
      return days[i]
    }

    // Hover indicator
    const hoverG = g.append('g').attr('class', 'hover-indicator').attr('pointer-events', 'none')
    const hoverLine = hoverG.append('line')
      .attr('stroke', 'rgba(255,255,255,0.15)').attr('stroke-width', 1)
      .attr('y1', 0).attr('y2', innerH).attr('display', 'none')
    const hoverDot = hoverG.append('circle')
      .attr('r', 3.5).attr('fill', 'var(--accent)')
      .attr('stroke', 'var(--bg)').attr('stroke-width', 1.5).attr('display', 'none')

    // Brush — sourceEvent guard prevents infinite loop from programmatic brush.move
    const brush = d3.brushX()
      .extent([[0, 0], [innerW, innerH]])
      .on('end', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.sourceEvent) return  // programmatic brush.move — ignore
        if (event.selection) {
          const [x0, x1] = event.selection as [number, number]
          const start = xScale.invert(x0)
          const end = xScale.invert(x1)
          start.setHours(0, 0, 0, 0)
          end.setHours(23, 59, 59, 999)
          onBrush([start, end])
        } else {
          // Click with no drag — snap to nearest day
          const [gx] = d3.pointer(event.sourceEvent, g.node()!)
          const day = nearestDay(gx)
          const start = new Date(day); start.setHours(0, 0, 0, 0)
          const end = new Date(day); end.setHours(23, 59, 59, 999)
          onBrush([start, end])
        }
      })

    const brushG = g.append('g').attr('class', 'brush')
    brushG.call(brush as d3.BrushBehavior<unknown>)
    brushRef.current = brush as d3.BrushBehavior<unknown>
    brushGRef.current = brushG

    brushG.select('.selection')
      .attr('fill', 'var(--accent)').attr('fill-opacity', 0.12)
      .attr('stroke', 'var(--accent)').attr('stroke-width', 1)

    brushG.select('.overlay')
      .style('cursor', 'crosshair')
      .on('mousemove', (event: MouseEvent) => {
        const [gx, gy] = d3.pointer(event, g.node()!)
        const [cx, cy] = d3.pointer(event, containerRef.current!)
        const hoveredDay = nearestDay(gx)
        const ds = hoveredDay.toISOString().slice(0, 10)
        const datum = dayDataMap.get(ds)
        const px = xScale(hoveredDay)
        hoverLine.attr('x1', px).attr('x2', px).attr('display', null)
        const totalVal = datum ? keys.reduce((s, k) => s + ((datum[k] as number) ?? 0), 0) : 0
        if (totalVal > 0) {
          hoverDot.attr('cx', px).attr('cy', yScale(totalVal)).attr('display', null)
        } else {
          hoverDot.attr('display', 'none')
        }
        if (datum) {
          setTooltip({ x: cx, y: cy, date: hoveredDay, values: keys.map((k) => ({ key: k, value: (datum[k] as number) ?? 0 })) })
        }
        void gy
      })
      .on('mouseleave', () => {
        hoverLine.attr('display', 'none')
        hoverDot.attr('display', 'none')
        setTooltip(null)
      })

    g.append('g').attr('class', 'trade-pin-layer')

    return () => { setTooltip(null) }
  }, [activeTab, width, innerW, innerH, days, stackedData, colorScale, keys, onBrush, dayDataMap, periodDays])

  // ─── Ticker highlight effect (2C) ─────────────────────────────────────────
  // Dims non-matching bar layers when a table row is hovered. D3 direct selection —
  // no React state involved, no re-render triggered.
  useEffect(() => {
    if (activeTab !== 'activity') return
    const svg = svgRef.current
    if (!svg) return
    d3.select(svg)
      .selectAll<SVGGElement, unknown>('g.layer')
      .transition()
      .duration(150)
      .attr('opacity', (_, i, nodes) => {
        if (!highlightedTicker) return 1
        const el = nodes[i] as SVGGElement
        return el.dataset.ticker === highlightedTicker ? 1 : 0.15
      })
  }, [highlightedTicker, activeTab])

  // ─── Trade annotation + expanded position ticks (2D) ─────────────────────
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const pinLayer = d3.select(svg).select<SVGGElement>('g.trade-pin-layer')
    pinLayer.selectAll('*').remove()

    if (!xScaleRef.current || activeTab !== 'activity') return

    const xScale = xScaleRef.current
    const [domainStart, domainEnd] = xScale.domain() as [Date, Date]

    // Expanded position ticks — all trades shown as short coloured marks
    if (expandedPositionTrades) {
      for (const t of expandedPositionTrades) {
        const tradeDate = new Date(t.date)
        tradeDate.setHours(0, 0, 0, 0)
        if (tradeDate < domainStart || tradeDate > domainEnd) continue
        const x = xScale(tradeDate)
        pinLayer.append('line')
          .attr('x1', x).attr('x2', x)
          .attr('y1', 0).attr('y2', 6)
          .attr('stroke', t.side === 'BUY' ? 'var(--positive)' : 'var(--negative)')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.7)
          .attr('pointer-events', 'none')
      }
    }

    // Selected trade — elevated dashed rule + label (overlays the tick marks above)
    if (selectedTrade) {
      const tradeDate = new Date(selectedTrade.trade.date)
      tradeDate.setHours(0, 0, 0, 0)
      if (tradeDate >= domainStart && tradeDate <= domainEnd) {
        const x = xScale(tradeDate)
        const labelOffset = x > innerW * 0.75 ? -4 : 4
        const anchor = labelOffset > 0 ? 'start' : 'end'

        pinLayer.append('line')
          .attr('x1', x).attr('x2', x).attr('y1', 0).attr('y2', innerH)
          .attr('stroke', 'var(--accent)').attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3,3').attr('opacity', 0.75)
          .attr('pointer-events', 'none')
        pinLayer.append('circle')
          .attr('cx', x).attr('cy', 1).attr('r', 3.5)
          .attr('fill', 'var(--accent)').attr('pointer-events', 'none')
        pinLayer.append('text')
          .attr('x', x + labelOffset).attr('y', 13)
          .attr('text-anchor', anchor)
          .attr('fill', 'var(--accent)')
          .attr('font-size', 9)
          .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
          .attr('font-weight', '600').attr('letter-spacing', '0.05em')
          .attr('pointer-events', 'none')
          .text(`${selectedTrade.position.ticker} · ${selectedTrade.trade.side}`)
      }
    }
  }, [selectedTrade, expandedPositionTrades, innerH, innerW, activeTab])

  // ─── P&L tab — area chart ─────────────────────────────────────────────────
  // Demonstrates: d3.line(), d3.area(), curveMonotoneX, SVG <defs>/<linearGradient>,
  // SVG <clipPath>, d3.transition() on path morphing.
  useEffect(() => {
    if (activeTab !== 'performance') return
    const svg = svgRef.current
    if (!svg || innerW <= 0) return

    const root = d3.select(svg)
    root.selectAll('*').remove()

    const g = root.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    const xScale = d3.scaleTime()
      .domain(d3.extent(perfSeries, (d) => d.date) as [Date, Date])
      .range([0, innerW])

    const [minPnl, maxPnl] = d3.extent(perfSeries, (d) => d.pnl) as [number, number]
    const absMax = Math.max(Math.abs(minPnl ?? 0), Math.abs(maxPnl ?? 0)) * 1.1
    const yScale = d3.scaleLinear().domain([-absMax, absMax]).range([innerH, 0])
    const y0 = yScale(0) // pixel position of the zero line

    // SVG <defs> — clipPath contains the area to axis box, gradient splits at zero
    const defs = root.append('defs')

    defs.append('clipPath')
      .attr('id', 'pnl-clip')
      .append('rect')
      .attr('x', MARGIN.left).attr('y', MARGIN.top)
      .attr('width', innerW).attr('height', innerH)

    // Gradient: green above zero, red below. gradientUnits="userSpaceOnUse" pins
    // the stops to absolute SVG coordinates so the split is always exactly at y=0.
    const grad = defs.append('linearGradient')
      .attr('id', 'pnl-gradient')
      .attr('gradientUnits', 'userSpaceOnUse')
      .attr('x1', 0).attr('x2', 0)
      .attr('y1', MARGIN.top).attr('y2', MARGIN.top + innerH)

    const zeroFrac = (MARGIN.top + y0) / (MARGIN.top + innerH)

    grad.append('stop').attr('offset', '0%').attr('stop-color', 'var(--positive)').attr('stop-opacity', 0.3)
    grad.append('stop').attr('offset', `${(zeroFrac * 100).toFixed(1)}%`).attr('stop-color', 'var(--positive)').attr('stop-opacity', 0.05)
    grad.append('stop').attr('offset', `${(zeroFrac * 100).toFixed(1)}%`).attr('stop-color', 'var(--negative)').attr('stop-opacity', 0.05)
    grad.append('stop').attr('offset', '100%').attr('stop-color', 'var(--negative)').attr('stop-opacity', 0.3)

    // Grid
    g.append('g')
      .attr('class', 'grid')
      .call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(() => ''))
      .call((ax) => {
        ax.select('.domain').remove()
        ax.selectAll('line').attr('stroke', 'var(--border)').attr('stroke-dasharray', '2,4')
      })

    // Zero baseline — explicit reference line
    g.append('line')
      .attr('x1', 0).attr('x2', innerW)
      .attr('y1', y0).attr('y2', y0)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1)

    // Area fill — clipped, gradient fill
    const area = d3.area<typeof perfSeries[0]>()
      .x((d) => xScale(d.date))
      .y0(y0)
      .y1((d) => yScale(d.pnl))
      .curve(d3.curveMonotoneX)

    g.append('path')
      .datum(perfSeries)
      .attr('fill', 'url(#pnl-gradient)')
      .attr('clip-path', 'url(#pnl-clip)')
      .attr('d', area)

    // Line — enter transition: draw from left edge
    const line = d3.line<typeof perfSeries[0]>()
      .x((d) => xScale(d.date))
      .y((d) => yScale(d.pnl))
      .curve(d3.curveMonotoneX)

    const path = g.append('path')
      .datum(perfSeries)
      .attr('fill', 'none')
      .attr('stroke', (perfSeries[perfSeries.length - 1]?.pnl ?? 0) >= 0 ? 'var(--positive)' : 'var(--negative)')
      .attr('stroke-width', 1.5)
      .attr('d', line)

    // Animate the line drawing in using stroke-dasharray trick
    const totalLength = (path.node() as SVGPathElement)?.getTotalLength() ?? 0
    path
      .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
      .attr('stroke-dashoffset', totalLength)
      .transition()
      .duration(500)
      .ease(d3.easeQuadOut)
      .attr('stroke-dashoffset', 0)

    // Axes
    const xFmt = periodDays <= 180 ? d3.timeFormat('%b %d') : d3.timeFormat('%b %Y')
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(8).tickFormat((d) => xFmt(d as Date)))
      .call((ax) => ax.select('.domain').remove())

    g.append('g')
      .attr('class', 'axis')
      .call(
        d3.axisLeft(yScale).ticks(6).tickFormat((v) => {
          const n = v as number
          if (Math.abs(n) >= 1_000_000) return `${n >= 0 ? '+' : ''}$${(n / 1_000_000).toFixed(1)}M`
          if (Math.abs(n) >= 1_000) return `${n >= 0 ? '+' : ''}$${(n / 1_000).toFixed(0)}K`
          return `$${n}`
        }),
      )
      .call((ax) => ax.select('.domain').remove())

    // Hover crosshair
    const hoverG = g.append('g').attr('class', 'hover-indicator').attr('pointer-events', 'none')
    const hoverLine = hoverG.append('line')
      .attr('stroke', 'rgba(255,255,255,0.15)').attr('stroke-width', 1)
      .attr('y1', 0).attr('y2', innerH).attr('display', 'none')
    const hoverDot = hoverG.append('circle')
      .attr('r', 3.5).attr('fill', 'var(--accent)')
      .attr('stroke', 'var(--bg)').attr('stroke-width', 1.5).attr('display', 'none')

    // Overlay for hover (full inner area)
    g.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', innerW).attr('height', innerH)
      .attr('fill', 'none').attr('pointer-events', 'all')
      .style('cursor', 'crosshair')
      .on('mousemove', function (event: MouseEvent) {
        const [gx, gy] = d3.pointer(event, g.node()!)
        const [cx, cy] = d3.pointer(event, containerRef.current!)
        const date = xScale.invert(gx)
        // Find nearest data point
        const nearest = perfSeries.reduce((best, cur) =>
          Math.abs(cur.date.getTime() - date.getTime()) < Math.abs(best.date.getTime() - date.getTime()) ? cur : best,
        )
        const px = xScale(nearest.date)
        hoverLine.attr('x1', px).attr('x2', px).attr('display', null)
        hoverDot.attr('cx', px).attr('cy', yScale(nearest.pnl)).attr('display', null)
        setTooltip({
          x: cx, y: cy, date: nearest.date,
          values: [{ key: 'Cumulative P&L', value: nearest.pnl }],
        })
        void gy
      })
      .on('mouseleave', () => {
        hoverLine.attr('display', 'none')
        hoverDot.attr('display', 'none')
        setTooltip(null)
      })

    return () => { setTooltip(null) }
  }, [activeTab, perfSeries, innerW, innerH, periodDays])

  // ─── Attribution tab — diverging horizontal bar chart ─────────────────────
  // Demonstrates: d3.scaleBand() (y-axis), diverging d3.scaleLinear() around zero,
  // inline SVG <text> value labels, d3.transition() on enter.
  useEffect(() => {
    if (activeTab !== 'attribution') return
    const svg = svgRef.current
    if (!svg || innerW <= 0) return

    const root = d3.select(svg)
    root.selectAll('*').remove()

    // Less margin on left for this chart — ticker labels go there
    const aMargin = { top: MARGIN.top, right: 80, bottom: 36, left: 64 }
    const aInnerW = width - aMargin.left - aMargin.right
    const aInnerH = height - aMargin.top - aMargin.bottom

    const g = root.append('g').attr('transform', `translate(${aMargin.left},${aMargin.top})`)

    const maxAbs = d3.max(attribution, (d) => Math.abs(d.pnlDollar)) ?? 1
    const xScale = d3.scaleLinear().domain([-maxAbs * 1.15, maxAbs * 1.15]).range([0, aInnerW])
    const x0 = xScale(0)

    const yScale = d3.scaleBand()
      .domain(attribution.map((d) => d.ticker))
      .range([0, aInnerH])
      .padding(0.3)

    // Zero axis
    g.append('line')
      .attr('x1', x0).attr('x2', x0)
      .attr('y1', 0).attr('y2', aInnerH)
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1)

    // Bars — animate growing out from the zero axis
    g.selectAll('rect')
      .data(attribution)
      .join('rect')
      .attr('x', x0)                // start at zero
      .attr('y', (d) => yScale(d.ticker) ?? 0)
      .attr('height', yScale.bandwidth())
      .attr('width', 0)             // start with 0 width
      .attr('rx', 1)
      .attr('fill', (d) => d.pnlDollar >= 0 ? 'rgba(34,197,94,0.6)' : 'rgba(239,68,68,0.6)')
      .call((sel) =>
        sel.transition().duration(400).ease(d3.easeQuadOut)
          .attr('x', (d) => d.pnlDollar >= 0 ? x0 : xScale(d.pnlDollar))
          .attr('width', (d) => Math.abs(xScale(d.pnlDollar) - x0))
      )

    // Ticker labels on the left
    g.selectAll('.tick-label')
      .data(attribution)
      .join('text')
      .attr('class', 'tick-label')
      .attr('x', x0 - 6)
      .attr('y', (d) => (yScale(d.ticker) ?? 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'var(--text-2)')
      .attr('font-size', 10)
      .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
      .attr('letter-spacing', '0.04em')
      .text((d) => d.ticker)

    // Value labels at bar ends
    g.selectAll('.value-label')
      .data(attribution)
      .join('text')
      .attr('class', 'value-label')
      .attr('x', (d) => d.pnlDollar >= 0 ? xScale(d.pnlDollar) + 4 : xScale(d.pnlDollar) - 4)
      .attr('y', (d) => (yScale(d.ticker) ?? 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', (d) => d.pnlDollar >= 0 ? 'start' : 'end')
      .attr('dominant-baseline', 'middle')
      .attr('fill', (d) => d.pnlDollar >= 0 ? 'var(--positive)' : 'var(--negative)')
      .attr('font-size', 9)
      .attr('font-family', "'JetBrains Mono', ui-monospace, monospace")
      .attr('opacity', 0)
      .text((d) => {
        const sign = d.pnlDollar >= 0 ? '+' : ''
        const abs = Math.abs(d.pnlDollar)
        return abs >= 1e6 ? `${sign}$${(d.pnlDollar / 1e6).toFixed(2)}M` : `${sign}$${(d.pnlDollar / 1e3).toFixed(1)}K`
      })
      .call((sel) => sel.transition().delay(300).duration(200).attr('opacity', 1))

    // Top axis (simplified)
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${aInnerH})`)
      .call(
        d3.axisBottom(xScale).ticks(5).tickFormat((v) => {
          const n = v as number
          if (Math.abs(n) >= 1e6) return `${n >= 0 ? '+' : ''}$${(n / 1e6).toFixed(1)}M`
          if (Math.abs(n) >= 1e3) return `${n >= 0 ? '+' : ''}$${(n / 1e3).toFixed(0)}K`
          return `$0`
        }),
      )
      .call((ax) => ax.select('.domain').remove())

  }, [activeTab, attribution, width, innerW, innerH])

  // ─── Render ───────────────────────────────────────────────────────────────
  const TABS: { id: TabId; label: string }[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'performance', label: 'P&L' },
    { id: 'attribution', label: 'Attribution' },
  ]

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: `${height}px`,
      }}
    >
      {/* Tab + period row — sits inside the MARGIN.top space (44px) */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: MARGIN.left,
        right: MARGIN.right,
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        zIndex: 10,
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {TABS.map(({ id, label }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: active ? '1px solid var(--accent)' : '1px solid transparent',
                  color: active ? 'var(--text-1)' : 'var(--text-2)',
                  fontSize: 11,
                  fontWeight: active ? 500 : 400,
                  fontFamily: 'ui-sans-serif, system-ui',
                  padding: '2px 10px 6px',
                  cursor: 'pointer',
                  letterSpacing: '0.02em',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Separator */}
        <div style={{ width: 1, height: 12, background: 'var(--border)', margin: '0 10px', flexShrink: 0 }} />

        {/* Period pills — only shown on Activity tab */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', gap: 2 }}>
            {PERIOD_OPTIONS.map(({ label, days: d }) => {
              const active = d === periodDays
              return (
                <button
                  key={label}
                  onClick={() => { onBrush(null); onPeriodChange(d) }}
                  style={{
                    background: active ? 'rgba(196,127,0,0.15)' : 'transparent',
                    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                    borderRadius: 3,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontFamily: 'ui-sans-serif, system-ui',
                    fontWeight: active ? 600 : 400,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    transition: 'all 0.12s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}

        {/* Legend — inline, right side — Activity tab only */}
        {activeTab === 'activity' && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
            {keys.map((k) => (
              <span key={k} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 9, color: 'var(--text-2)',
                fontFamily: 'ui-sans-serif, system-ui',
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: 1,
                  background: colorScale(k), flexShrink: 0,
                }} />
                {k}
              </span>
            ))}
          </div>
        )}

        {/* Attribution label */}
        {activeTab === 'attribution' && (
          <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text-2)', fontStyle: 'italic' }}>
            P&L by ticker
          </span>
        )}
      </div>

      {/* Clear filter — only on Activity tab */}
      {hasBrush && activeTab === 'activity' && (
        <button
          onClick={clearBrush}
          style={{
            position: 'absolute', top: 8, right: 8, zIndex: 10,
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'var(--surface)', border: '1px solid var(--accent)',
            color: 'var(--accent)', borderRadius: 3, padding: '2px 8px',
            fontSize: 11, fontFamily: 'ui-sans-serif, system-ui',
            cursor: 'pointer', letterSpacing: '0.02em',
          }}
        >
          <X size={11} weight="bold" />
          Clear filter
        </button>
      )}

      <svg
        ref={svgRef}
        width={width}
        height={height}
        aria-label="Portfolio chart"
        role="img"
      />

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: Math.min(tooltip.x + 12, width - 180),
          top: Math.max(tooltip.y - 60, 4),
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 4, padding: '8px 10px',
          pointerEvents: 'none', zIndex: 20, minWidth: 160,
        }}>
          <div style={{
            fontSize: 10, color: 'var(--text-2)', marginBottom: 6,
            fontFamily: 'ui-sans-serif, system-ui',
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>
            {d3.timeFormat('%b %d, %Y')(tooltip.date)}
          </div>
          {tooltip.values.filter((v) => v.value !== 0).map((v) => (
            <div key={v.key} style={{
              display: 'flex', justifyContent: 'space-between',
              gap: 16, marginBottom: 2, alignItems: 'center',
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: 'var(--text-1)',
                fontFamily: 'ui-sans-serif, system-ui',
              }}>
                {v.key !== 'Cumulative P&L' && (
                  <span style={{
                    width: 6, height: 6, borderRadius: 1,
                    background: colorScale(v.key), flexShrink: 0,
                  }} />
                )}
                {v.key}
              </span>
              <span className="num" style={{
                color: v.key === 'Cumulative P&L'
                  ? (v.value >= 0 ? 'var(--positive)' : 'var(--negative)')
                  : 'var(--text-1)',
              }}>
                {v.key === 'Cumulative P&L'
                  ? `${v.value >= 0 ? '+' : ''}$${(v.value / 1000).toFixed(1)}K`
                  : `$${(v.value / 1000).toFixed(1)}K`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
