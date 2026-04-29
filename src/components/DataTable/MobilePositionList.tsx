import { useState, useCallback } from 'react'
import { portfolioData } from '../../data/generateData'
import type { Trade, Position } from '../../data/types'
import { fmtDollar } from '../../lib/format'
import { Sparkline } from './Sparkline'
import { TradeDetailPanel } from './TradeDetailPanel'
import styles from './table.module.css'

interface SelectedTrade { trade: Trade; position: Position }

export const MobilePositionList = () => {
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<SelectedTrade | null>(null)

  const filtered = filter
    ? portfolioData.filter(p => p.ticker.toUpperCase().includes(filter.toUpperCase()))
    : portfolioData

  const handleTradeSelect = useCallback((trade: Trade, position: Position) => {
    setSelected(prev =>
      prev?.trade.tradeId === trade.tradeId ? null : { trade, position }
    )
  }, [])

  return (
    <div className={styles.mobileList}>
      <div className={styles.mobileFilterBar}>
        <svg
          width="13" height="13" viewBox="0 0 16 16" fill="none"
          className={styles.mobileFilterIcon}
          aria-hidden="true"
        >
          <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by ticker…"
          className={styles.mobileFilterInput}
          autoCapitalize="characters"
        />
      </div>

      <div className={styles.mobileScroll}>
        {filtered.map((pos) => {
          const isPositive = pos.pnlDollar >= 0
          return (
            <div
              key={pos.id}
              className={styles.mobileRow}
              onClick={() => {
                /* expand to show first trade on tap — open detail on second tap */
                if (pos.trades.length > 0) {
                  const t = pos.trades[0]!
                  handleTradeSelect(t, pos)
                }
              }}
            >
              <div className={styles.mobileTicker}>{pos.ticker}</div>

              <div className={styles.mobileStats}>
                <span
                  className={styles.mobilePnl}
                  style={{ color: isPositive ? 'var(--positive)' : 'var(--negative)' }}
                >
                  {isPositive ? '+' : ''}${fmtDollar(pos.pnlDollar)}
                  {' '}
                  <span style={{ fontSize: 10, opacity: 0.8 }}>
                    ({isPositive ? '+' : ''}{pos.pnlPercent.toFixed(2)}%)
                  </span>
                </span>
                <span className={styles.mobileSubtext}>
                  {pos.trades.length} trade{pos.trades.length !== 1 ? 's' : ''} · avg ${fmtDollar(pos.avgCost)}
                </span>
              </div>

              <div className={styles.mobileTrend}>
                <Sparkline trades={pos.trades} pnlDollar={pos.pnlDollar} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom-sheet trade detail overlay */}
      {selected && (
        <div
          className={styles.mobileOverlay}
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}
        >
          <div className={styles.mobileSheet}>
            <div className={styles.mobileSheetHandle} />
            <TradeDetailPanel
              trade={selected.trade}
              position={selected.position}
              onClose={() => setSelected(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
