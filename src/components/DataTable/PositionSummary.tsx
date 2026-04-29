import type { Trade } from '../../data/types'
import { Box } from '../ui/Box'
import { Text } from '../ui/Text'
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
      <Box display="flex" alignItems="center" gap={6} flexShrink={0}>
        <Text variant="caption" color="var(--positive)" weight={600} style={{ letterSpacing: '0.04em' }}>
          {buyCount} BUY
        </Text>
        <Text variant="caption" color="var(--border)">·</Text>
        <Text variant="caption" color="var(--negative)" weight={600} style={{ letterSpacing: '0.04em' }}>
          {sellCount} SELL
        </Text>
      </Box>

      <div className={styles.summaryBar}>
        <div className={styles.summaryBarFill} style={{ width: `${buyRatio}%` }} />
      </div>

      <Text variant="monoSm" className={styles.summaryVolume}>
        ${(totalValue / 1000).toFixed(1)}K traded
      </Text>
    </div>
  )
}
