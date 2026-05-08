import { useState, useMemo, useCallback } from 'react'
import { PortfolioChart, type SelectedTrade } from './PortfolioChart'
import { DataTable } from './DataTable'
import { TradeDetailPanel } from './DataTable/TradeDetailPanel'
import { StatStrip } from './StatStrip'
import { COLUMNS } from './DataTable/columns'
import { portfolioData } from '../data/generateData'
import type { Trade, Position } from '../data/types'
import styles from './ChartTableView.module.css'

export const ChartTableView = () => {
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(null)
  const [globalFilter, setGlobalFilter] = useState('')
  const [selectedTrade, setSelectedTrade] = useState<SelectedTrade | null>(null)
  const [periodDays, setPeriodDays] = useState(90)
  const [hoveredTicker, setHoveredTicker] = useState<string | null>(null)
  const [expandedPositionTrades, setExpandedPositionTrades] = useState<Trade[] | null>(null)

  const filteredIds = useMemo<Set<number> | null>(() => {
    if (!dateRange) return null
    const [start, end] = dateRange
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

  const handleTradeSelect = useCallback((trade: Trade, position: Position) => {
    setSelectedTrade((prev: SelectedTrade | null) =>
      prev?.trade.tradeId === trade.tradeId ? null : { trade, position },
    )
  }, [])

  const positionCount = useMemo(
    () => dateRange
      ? portfolioData.filter((p) => filteredIds?.has(p.id)).length
      : portfolioData.length,
    [dateRange, filteredIds],
  )

  return (
    <div className={styles.root}>
      <PortfolioChart
        onBrush={setDateRange}
        hasBrush={dateRange !== null}
        selectedTrade={selectedTrade}
        periodDays={periodDays}
        onPeriodChange={setPeriodDays}
        highlightedTicker={hoveredTicker}
        expandedPositionTrades={expandedPositionTrades}
      />

      <StatStrip
        filteredIds={filteredIds}
        dateRange={dateRange}
        globalFilter={globalFilter}
      />

      <div className={styles.toolbar}>
        <div className={styles.filterWrap}>
          <svg
            width="12" height="12" viewBox="0 0 16 16" fill="none"
            className={styles.filterIcon}
            aria-hidden="true"
          >
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter by ticker…"
            className={styles.filterInput}
          />
        </div>

        {selectedTrade && (
          <span className={styles.pinnedBadge}>
            <span className={styles.pinnedDot} />
            {selectedTrade.position.ticker} · {selectedTrade.trade.side} pinned
          </span>
        )}

        <span className={styles.posCount}>
          {dateRange
            ? `Filtered · ${positionCount.toLocaleString()} positions`
            : `${portfolioData.length.toLocaleString()} positions`}
        </span>
      </div>

      <div className={styles.tableArea}>
        <DataTable
          columns={COLUMNS}
          filteredIds={filteredIds}
          globalFilter={globalFilter}
          selectedTradeId={selectedTrade?.trade.tradeId ?? null}
          onTradeSelect={handleTradeSelect}
          onTickerHover={setHoveredTicker}
          onExpandedTradesChange={setExpandedPositionTrades}
        />

        {/* width is dynamic so stays inline */}
        <div
          className={styles.detailSlider}
          style={{ width: selectedTrade ? 284 : 0, borderLeft: selectedTrade ? undefined : 'none' }}
        >
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
