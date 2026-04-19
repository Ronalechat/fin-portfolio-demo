import { useState, useMemo, useCallback } from 'react'
import { PortfolioChart, type SelectedTrade } from './PortfolioChart'
import { DataTable } from './DataTable'
import { TradeDetailPanel } from './DataTable/TradeDetailPanel'
import { StatStrip } from './StatStrip'
import { portfolioData } from '../data/generateData'
import type { Trade, Position } from '../data/types'

export function ChartTableView() {
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(null)
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedTrade, setSelectedTrade] = useState<SelectedTrade | null>(null)
  const [periodDays, setPeriodDays] = useState(90)
  // 2C — bidirectional hover: table row hover → chart ticker highlight
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)
  // 2D — expand trade ticks on chart when a position is expanded in the table
  const [expandedPositionTrades, setExpandedPositionTrades] = useState<Trade[] | null>(null)

  const filteredIds = useMemo<Set<number> | null>(() => {
    if (!dateRange) return null
    const [start, end] = dateRange
    // ISO date strings (YYYY-MM-DD) sort lexicographically — no Date objects needed.
    // Avoids up to N×trades `new Date()` constructions on every brush drag event.
    const startStr = start.toISOString().slice(0, 10)
    const endStr   = end.toISOString().slice(0, 10)
    const ids = new Set<number>()
    for (const pos of portfolioData) {
      for (const trade of pos.trades) {
        if (trade.date >= startStr && trade.date <= endStr) {
          ids.add(pos.id)
          break
        }
      }
    }
    return ids
  }, [dateRange])

  // useCallback: stable reference prevents DataTable from re-rendering on every
  // ChartTableView render (e.g. hoveredTicker changes ~60x/sec while scrolling).
  const handleTradeSelect = useCallback((trade: Trade, position: Position) => {
    setSelectedTrade((prev: SelectedTrade | null) =>
      prev?.trade.tradeId === trade.tradeId ? null : { trade, position },
    )
  }, [])

  // useMemo: 5,000-item filter was running on every render (including each hover).
  const positionCount = useMemo(
    () => dateRange
      ? portfolioData.filter((p) => filteredIds?.has(p.id)).length
      : portfolioData.length,
    [dateRange, filteredIds],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PortfolioChart
        onBrush={setDateRange}
        hasBrush={dateRange !== null}
        selectedTrade={selectedTrade}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
        highlightedTicker={hoveredTicker}
        expandedPositionTrades={expandedPositionTrades}
      />

      {/* Stat strip — shows what both the chart and table are looking at */}
      <StatStrip
        filteredIds={filteredIds}
        dateRange={dateRange}
        globalFilter={globalFilter}
      />

      {/* Table toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none"
            style={{ position: 'absolute', left: 8, color: 'var(--text-2)', pointerEvents: 'none' }}
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter by ticker…"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: 'var(--text-1)',
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: 11,
              padding: '4px 8px 4px 26px',
              width: 160,
              outline: 'none',
              letterSpacing: '0.02em',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          />
        </div>

        {selectedTrade && (
          <span style={{
            fontSize: 10, color: 'var(--accent)',
            fontFamily: 'ui-sans-serif, system-ui',
            letterSpacing: '0.04em',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent)', flexShrink: 0,
            }} />
            {selectedTrade.position.ticker} · {selectedTrade.trade.side} pinned
          </span>
        )}

        <span style={{
          marginLeft: 'auto', fontSize: 10, color: 'var(--text-2)',
          fontFamily: 'ui-sans-serif, system-ui', letterSpacing: '0.04em',
        }}>
          {dateRange ? `Filtered · ${positionCount.toLocaleString()} positions` : `${portfolioData.length.toLocaleString()} positions`}
        </span>
      </div>

      {/* Table + detail panel */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DataTable
          filteredIds={filteredIds}
          globalFilter={globalFilter}
          selectedTradeId={selectedTrade?.trade.tradeId ?? null}
          onTradeSelect={handleTradeSelect}
          onTickerHover={setHoveredTicker}
          onExpandedTradesChange={setExpandedPositionTrades}
        />

        {/* Detail panel slides in from right */}
        <div style={{
          width: selectedTrade ? 284 : 0,
          flexShrink: 0,
          overflow: 'hidden',
          borderLeft: selectedTrade ? '1px solid var(--border)' : 'none',
          transition: 'width 0.2s ease',
        }}>
          {selectedTrade && (
            <TradeDetailPanel
              trade={selectedTrade.trade}
              position={selectedTrade.position}
              onClose={() => setSelectedTrade(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
