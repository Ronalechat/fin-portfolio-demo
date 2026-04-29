import type { Trade, Position } from '../../data/types'
import { X } from '@phosphor-icons/react'
import { fmtDollar, fmtDateFull } from '../../lib/format'
import { daysAgo, settlementDate } from './table.logic'
import { Box } from '../ui/Box'
import { Text } from '../ui/Text'
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
          <Text variant="labelSm" as="div" style={{ marginBottom: 2 }}>Trade detail</Text>
          <Text variant="monoSm" color="var(--accent)" style={{ fontSize: 10 }}>{trade.tradeId}</Text>
        </div>
        <button onClick={onClose} className={styles.closeBtn} aria-label="Close trade detail">
          <X size={13} weight="bold" />
        </button>
      </div>

      <div className={styles.detailBody}>
        <Box display="flex" alignItems="center" gap={8} style={{ marginBottom: 12 }}>
          <span className={`${styles.sideBadge} ${isBuy ? styles.sideBadgeBuy : styles.sideBadgeSell}`}>
            {trade.side}
          </span>
          <Text variant="caption" style={{ fontSize: 11 }}>{fmtDateFull(trade.date)}</Text>
        </Box>

        <Text variant="labelSm" as="div" className={styles.detailSection}>Execution</Text>
        <div className={styles.execGrid}>
          {[
            { label: 'Qty',   value: trade.quantity.toLocaleString() },
            { label: 'Price', value: `$${fmtDollar(trade.price)}` },
            { label: 'Value', value: `$${(tradeValue / 1000).toFixed(1)}K` },
          ].map(({ label, value }) => (
            <div key={label} className={styles.execCell}>
              <Text variant="labelSm">{label}</Text>
              <Text variant="mono">{value}</Text>
            </div>
          ))}
        </div>

        <Text variant="labelSm" as="div" className={styles.detailSection}>
          Position — {position.ticker}
        </Text>

        <div className={styles.detailRow}>
          <Text variant="label" className={styles.detailLabel}>Avg cost</Text>
          <Text variant="mono" className={styles.detailValue}>${fmtDollar(position.avgCost)}</Text>
        </div>
        <div className={styles.detailRow}>
          <Text variant="label" className={styles.detailLabel}>Trade price</Text>
          <Text variant="mono" color={priceDelta >= 0 ? 'var(--positive)' : 'var(--negative)'}>
            ${fmtDollar(trade.price)}{' '}
            <Text variant="caption" style={{ opacity: 0.8 }}>
              ({priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)}%)
            </Text>
          </Text>
        </div>

        {estPnl !== null ? (
          <div className={styles.detailRow}>
            <Text variant="label" className={styles.detailLabel}>Realised P&L</Text>
            <Text variant="mono" color={estPnl >= 0 ? 'var(--positive)' : 'var(--negative)'}>
              {estPnl >= 0 ? '+' : ''}${fmtDollar(estPnl)}
            </Text>
          </div>
        ) : (
          <div className={styles.detailRow}>
            <Text variant="label" className={styles.detailLabel}>P&L</Text>
            <Text variant="monoSm" style={{ fontSize: 10 }}>unrealised — adds to basis</Text>
          </div>
        )}

        <div className={styles.detailRow}>
          <Text variant="label" className={styles.detailLabel}>Position share</Text>
          <Text variant="mono" className={styles.detailValue}>{positionShare.toFixed(1)}%</Text>
        </div>

        <div className={styles.detailRow} style={{ marginTop: 2 }}>
          <Text variant="label" className={styles.detailLabel}>Position P&L</Text>
          <Text variant="mono" color={position.pnlDollar >= 0 ? 'var(--positive)' : 'var(--negative)'}>
            {position.pnlDollar >= 0 ? '+' : ''}${fmtDollar(position.pnlDollar)}
          </Text>
        </div>

        <div className={styles.detailDivider} />

        <Text variant="labelSm" as="div" className={styles.detailSection}>Timeline</Text>
        <div className={styles.detailRow}>
          <Text variant="label" className={styles.detailLabel}>Executed</Text>
          <Text variant="mono" className={`${styles.detailValue} ${styles.muted}`}>
            {age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`}
          </Text>
        </div>
        <div className={styles.detailRow}>
          <Text variant="label" className={styles.detailLabel}>Settlement</Text>
          <Text variant="mono" className={`${styles.detailValue} ${styles.muted}`}>
            {settlementDate(trade.date)}
          </Text>
        </div>
      </div>
    </div>
  )
}
