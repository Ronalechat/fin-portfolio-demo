import type { Trade, Position } from '../../data/types'
import { X } from '@phosphor-icons/react'
import { fmtDollar, fmtDateFull } from '../../lib/format'
import { daysAgo, settlementDate } from './table.logic'
import styles from './table.module.css'

interface Props {
  trade: Trade
  position: Position
  onClose: () => void
}

export const TradeDetailPanel = ({ trade, position, onClose }: Props) => {
  const isBuy = trade.side === 'BUY'
  const tradeValue = trade.price * trade.quantity
  const priceDelta = ((trade.price - position.avgCost) / position.avgCost) * 100
  const positionShare = (trade.quantity / position.quantity) * 100
  const estPnl = isBuy ? null : (trade.price - position.avgCost) * trade.quantity
  const age = daysAgo(trade.date)

  return (
    <div className={styles.detailPanel}>
      <div className={styles.detailHeader}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
            Trade detail
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 10, color: 'var(--accent)', letterSpacing: '0.03em' }}>
            {trade.tradeId}
          </div>
        </div>
        <button onClick={onClose} className={styles.closeBtn} aria-label="Close trade detail">
          <X size={13} weight="bold" />
        </button>
      </div>

      <div className={styles.detailBody}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className={`${styles.sideBadge} ${isBuy ? styles.sideBadgeBuy : styles.sideBadgeSell}`}>
            {trade.side}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtDateFull(trade.date)}</span>
        </div>

        <div className={styles.detailSection}>Execution</div>
        <div className={styles.execGrid}>
          {[
            { label: 'Qty',   value: trade.quantity.toLocaleString() },
            { label: 'Price', value: `$${fmtDollar(trade.price)}` },
            { label: 'Value', value: `$${(tradeValue / 1000).toFixed(1)}K` },
          ].map(({ label, value }) => (
            <div key={label} className={styles.execCell}>
              <span style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {label}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.detailSection}>Position — {position.ticker}</div>

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Avg cost</span>
          <span className={styles.detailValue}>${fmtDollar(position.avgCost)}</span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Trade price</span>
          <span className={`${styles.detailValue} ${priceDelta >= 0 ? styles.positive : styles.negative}`}>
            ${fmtDollar(trade.price)}{' '}
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              ({priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)}%)
            </span>
          </span>
        </div>

        {estPnl !== null ? (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Realised P&L</span>
            <span className={`${styles.detailValue} ${estPnl >= 0 ? styles.positive : styles.negative}`}>
              {estPnl >= 0 ? '+' : ''}${fmtDollar(estPnl)}
            </span>
          </div>
        ) : (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>P&L</span>
            <span className={styles.detailValue} style={{ color: 'var(--text-2)', fontSize: 10 }}>
              unrealised — adds to basis
            </span>
          </div>
        )}

        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Position share</span>
          <span className={styles.detailValue}>{positionShare.toFixed(1)}%</span>
        </div>

        <div className={styles.detailRow} style={{ marginTop: 2 }}>
          <span className={styles.detailLabel}>Position P&L</span>
          <span className={`${styles.detailValue} ${position.pnlDollar >= 0 ? styles.positive : styles.negative}`}>
            {position.pnlDollar >= 0 ? '+' : ''}${fmtDollar(position.pnlDollar)}
          </span>
        </div>

        <div className={styles.detailDivider} />

        <div className={styles.detailSection}>Timeline</div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Executed</span>
          <span className={`${styles.detailValue} ${styles.muted}`}>
            {age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`}
          </span>
        </div>
        <div className={styles.detailRow}>
          <span className={styles.detailLabel}>Settlement</span>
          <span className={`${styles.detailValue} ${styles.muted}`}>{settlementDate(trade.date)}</span>
        </div>
      </div>
    </div>
  )
}
