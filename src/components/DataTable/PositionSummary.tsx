import type { Trade } from '../../data/types'
import styles from './table.module.css'

interface PositionSummaryProps { trades: Trade[] }

export const PositionSummary = ({ trades }: PositionSummaryProps) => {
  let buyCount = 0, sellCount = 0, buyValue = 0, sellValue = 0
  for (const t of trades) {
    const val = t.price * t.quantity
    if (t.side === 'BUY') { buyCount++; buyValue += val }
    else { sellCount++; sellValue += val }
  }
  const totalValue = buyValue + sellValue
  const buyRatio = totalValue > 0 ? (buyValue / totalValue) * 100 : 50

  return (
    <div className={styles.summaryRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }} className={styles.positive}>
          {buyCount} BUY
        </span>
        <span style={{ fontSize: 9 }} className={styles.muted}>·</span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }} className={styles.negative}>
          {sellCount} SELL
        </span>
      </div>

      <div className={styles.summaryBar}>
        <div className={styles.summaryBarFill} style={{ width: `${buyRatio}%` }} />
      </div>

      <div className={styles.summaryVolume}>
        ${(totalValue / 1000).toFixed(1)}K traded
      </div>
    </div>
  )
}
