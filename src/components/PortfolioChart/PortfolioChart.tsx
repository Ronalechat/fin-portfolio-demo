import { useRef, useEffect, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { useChartData } from './useChartData'
import type { DayDatum } from './useChartData'
import { X } from '@phosphor-icons/react'

interface Props {
  onBrush: (range: [Date, Date] | null) => void
  hasBrush: boolean
}

interface TooltipState {
  x: number
  y: number
  date: Date
  values: { key: string; value: number }[]
}

const MARGIN = { top: 16, right: 20, bottom: 36, left: 72 }

export function PortfolioChart({ onBrush, hasBrush }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const brushRef = useRef<d3.BrushBehavior<unknown> | null>(null)
  const brushGRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [width, setWidth] = useState(800)

  const { days, keys, stackedData, colorScale } = useChartData()

  const height = 280
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom

  const clearBrush = useCallback(() => {
    if (brushRef.current && brushGRef.current) {
      brushGRef.current.call(brushRef.current.clear)
    }
    onBrush(null)
  }, [onBrush])

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

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || innerW <= 0) return

    const root = d3.select(svg)
    root.selectAll('*').remove()

    const g = root
      .append('g')
      .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // Scales
    const xScale = d3
      .scaleBand<Date>()
      .domain(days)
      .range([0, innerW])
      .padding(0.15)

    const maxY = d3.max(stackedData[stackedData.length - 1], (d) => d[1]) ?? 0

    const yScale = d3
      .scaleLinear()
      .domain([0, maxY * 1.05])
      .range([innerH, 0])

    // Grid lines
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yScale)
          .tickSize(-innerW)
          .tickFormat(() => ''),
      )
      .call((ax) => {
        ax.select('.domain').remove()
        ax.selectAll('line')
          .attr('stroke', 'var(--border)')
          .attr('stroke-dasharray', '2,4')
      })

    // Stacked bars
    const layers = g
      .selectAll('.layer')
      .data(stackedData)
      .join('g')
      .attr('class', 'layer')
      .attr('fill', (d) => colorScale(d.key))

    layers
      .selectAll('rect')
      .data((d) => d)
      .join('rect')
      .attr('x', (d) => xScale((d.data as DayDatum).date as Date) ?? 0)
      .attr('y', (d) => yScale(d[1]))
      .attr('height', (d) => Math.max(0, yScale(d[0]) - yScale(d[1])))
      .attr('width', xScale.bandwidth())
      .attr('rx', 1)
      .style('cursor', 'crosshair')
      .on('mousemove', (event, d) => {
        const datum = d.data as DayDatum
        const values = keys.map((k) => ({
          key: k,
          value: (datum[k] as number) ?? 0,
        }))
        const [mx, my] = d3.pointer(event, containerRef.current!)
        setTooltip({ x: mx, y: my, date: datum.date as Date, values })
      })
      .on('mouseleave', () => setTooltip(null))

    // X axis
    const tickEvery = Math.ceil(days.length / 10)
    g.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(days.filter((_, i) => i % tickEvery === 0))
          .tickFormat((d) => d3.timeFormat('%b %d')(d as Date)),
      )
      .call((ax) => ax.select('.domain').remove())

    // Y axis
    g.append('g')
      .attr('class', 'axis')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickFormat((v) => {
            const n = v as number
            if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
            if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
            return `$${n}`
          }),
      )
      .call((ax) => ax.select('.domain').remove())

    // Brush
    const brush = d3
      .brushX()
      .extent([
        [0, 0],
        [innerW, innerH],
      ])
      .on('end', (event: d3.D3BrushEvent<unknown>) => {
        if (!event.selection) {
          onBrush(null)
          return
        }
        const [x0, x1] = event.selection as [number, number]
        const bandwidth = xScale.bandwidth()
        const d0 = xScale.domain().find(
          (d) => (xScale(d) ?? 0) + bandwidth / 2 >= x0,
        )
        const d1 = [...xScale.domain()].reverse().find(
          (d) => (xScale(d) ?? 0) + bandwidth / 2 <= x1,
        )
        if (d0 && d1) {
          const start = new Date(d0 as Date)
          const end = new Date(d1 as Date)
          end.setHours(23, 59, 59, 999)
          onBrush([start, end])
        }
      })

    const brushG = g.append('g').attr('class', 'brush')
    brushG.call(brush as d3.BrushBehavior<unknown>)

    brushRef.current = brush as d3.BrushBehavior<unknown>
    brushGRef.current = brushG

    // Style brush
    brushG.select('.selection')
      .attr('fill', 'var(--accent)')
      .attr('fill-opacity', 0.12)
      .attr('stroke', 'var(--accent)')
      .attr('stroke-width', 1)

    return () => {
      setTooltip(null)
    }
  }, [width, innerW, innerH, days, stackedData, colorScale, keys, onBrush])

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
      {hasBrush && (
        <button
          onClick={clearBrush}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--surface)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: 11,
            fontFamily: 'ui-sans-serif, system-ui',
            cursor: 'pointer',
            letterSpacing: '0.02em',
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
        aria-label="Portfolio value over last 30 days"
        role="img"
      />

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 6,
          right: 8,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {keys.map((k) => (
          <span
            key={k}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 10,
              color: 'var(--text-2)',
              fontFamily: 'ui-sans-serif, system-ui',
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 1,
                background: colorScale(k),
                flexShrink: 0,
              }}
            />
            {k}
          </span>
        ))}
      </div>

      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(tooltip.x + 12, width - 180),
            top: Math.max(tooltip.y - 60, 4),
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '8px 10px',
            pointerEvents: 'none',
            zIndex: 20,
            minWidth: 160,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-2)',
              marginBottom: 6,
              fontFamily: 'ui-sans-serif, system-ui',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {d3.timeFormat('%b %d, %Y')(tooltip.date)}
          </div>
          {tooltip.values
            .filter((v) => v.value > 0)
            .map((v) => (
              <div
                key={v.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  marginBottom: 2,
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: 11,
                    color: 'var(--text-1)',
                    fontFamily: 'ui-sans-serif, system-ui',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 1,
                      background: colorScale(v.key),
                      flexShrink: 0,
                    }}
                  />
                  {v.key}
                </span>
                <span className="num" style={{ color: 'var(--text-1)' }}>
                  ${(v.value / 1000).toFixed(1)}K
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
