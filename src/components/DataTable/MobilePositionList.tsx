import { useState, useEffect, useCallback, useRef } from 'react'
import { portfolioData } from '../../data/generateData'
import type { Trade, Position } from '../../data/types'
import type { SelectedTrade } from '../PortfolioChart/PortfolioChart'
import { fmtDollar } from '../../lib/format'
import { Sparkline } from './Sparkline'
import { TradeDetailPanel } from './TradeDetailPanel'
import styles from './table.module.css'

interface Props {
  selectedTrade?: SelectedTrade | null
  onTradeSelect?: (st: SelectedTrade | null) => void
  filteredIds?: Set<number> | null
}

export const MobilePositionList = ({ selectedTrade: selectedProp, onTradeSelect, filteredIds }: Props) => {
  const [filter, setFilter] = useState('')
  const [selectedLocal, setSelectedLocal] = useState<SelectedTrade | null>(null)

  const isControlled = selectedProp !== undefined
  const selected = isControlled ? selectedProp : selectedLocal

  const setSelected = useCallback((st: SelectedTrade | null) => {
    if (isControlled) {
      onTradeSelect?.(st)
    } else {
      setSelectedLocal(st)
    }
  }, [isControlled, onTradeSelect])

  // Scroll lock — target only the list container, not the whole page
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.style.overflow = selected ? 'hidden' : ''
    return () => { el.style.overflow = '' }
  }, [selected])

  // Drag-to-dismiss
  const [dragY, setDragY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStart.current = e.touches[0]!.clientY
    setIsDragging(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const delta = e.touches[0]!.clientY - dragStart.current
    setDragY(Math.max(0, delta))
  }, [])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
    if (dragY > 120) {
      setSelected(null)
    }
    setDragY(0)
  }, [dragY, setSelected])

  const filtered = filter
    ? portfolioData.filter(p => p.ticker.toUpperCase().includes(filter.toUpperCase()))
    : portfolioData

  const handleRowTap = useCallback((trade: Trade, position: Position) => {
    const isActive = selected?.trade.tradeId === trade.tradeId
    setSelected(isActive ? null : { trade, position })
  }, [selected, setSelected])

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

      <div ref={scrollRef} className={styles.mobileScroll}>
        {filtered.map((pos) => {
          const isPositive = pos.pnlDollar >= 0
          const isDimmed = filteredIds != null && !filteredIds.has(pos.id)
          return (
            <div
              key={pos.id}
              className={styles.mobileRow}
              style={{ opacity: isDimmed ? 0.3 : 1, transition: 'opacity 0.2s ease' }}
              onClick={() => {
                if (pos.trades.length > 0) {
                  handleRowTap(pos.trades[0]!, pos)
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
          <div
            className={styles.mobileSheet}
            style={{
              transform: `translateY(${dragY}px)`,
              transition: isDragging ? 'none' : 'transform 0.2s ease',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
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
