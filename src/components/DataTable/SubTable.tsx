import { useState } from 'react'
import type { Trade, Position } from '../../data/types'
import { fmtDate, fmtDollar } from '../../lib/format'
import { sortTrades } from './table.logic'
import type { SortKey, SortState, SubTableCol } from './table.types'
import { PositionSummary } from './PositionSummary'
import { Text } from '../ui/Text'
import styles from './table.module.css'

interface Props {
  trades: Trade[]
  position: Position
  selectedTradeId: string | null
  onTradeSelect: (trade: Trade) => void
}

const COLS: SubTableCol[] = [
  { key: 'date',  label: 'Date',   align: 'left',  width: '20%' },
  { key: 'qty',   label: 'Qty',    align: 'right', width: '13%' },
  { key: 'price', label: 'Price',  align: 'right', width: '17%' },
  { key: 'value', label: 'Value',  align: 'right', width: '17%' },
  { key: 'delta', label: 'vs Avg', align: 'right', width: '17%' },
]

const SIDE_WIDTH = '16%'

const SortIcon = ({ col, sort }: { col: SortKey; sort: SortState | null }) => {
  if (!sort || sort.key !== col) {
    return <Text variant="monoSm" style={{ opacity: 0.3, fontSize: 8 }}>⇅</Text>
  }
  return (
    <Text variant="monoSm" color="var(--accent)" style={{ fontSize: 9 }}>
      {sort.desc ? '↓' : '↑'}
    </Text>
  )
}

export const SubTable = ({ trades, position, selectedTradeId, onTradeSelect }: Props) => {
  const [sort, setSort] = useState<SortState | null>(null)

  const handleHeaderClick = (key: SortKey) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, desc: false }
      if (!prev.desc) return { key, desc: true }
      return null
    })
  }

  const sorted = sortTrades(trades, sort, position.avgCost)

  return (
    <div className={styles.subTableWrap}>
      <PositionSummary trades={trades} />

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            <th className={styles.subTh} style={{ textAlign: 'left', width: SIDE_WIDTH }}>
              Side
            </th>
            {COLS.map(({ key, label, align, width }) => {
              const active = sort?.key === key
              return (
                <th
                  key={key}
                  onClick={(e) => { e.stopPropagation(); handleHeaderClick(key) }}
                  className={`${styles.subTh} ${styles.subThSortable} ${active ? styles.subThSorted : ''}`}
                  style={{ textAlign: align, width }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    justifyContent: align === 'left' ? 'flex-start' : 'flex-end',
                  }}>
                    {label}
                    <SortIcon col={key} sort={sort} />
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => {
            const isBuy = t.side === 'BUY'
            const isSelected = selectedTradeId === t.tradeId
            const delta = ((t.price - position.avgCost) / position.avgCost) * 100

            return (
              <tr
                key={t.tradeId}
                className="row-trade"
                data-side={t.side}
                data-selected={isSelected ? 'true' : undefined}
                onClick={(e) => { e.stopPropagation(); onTradeSelect(t) }}
                style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
              >
                <td
                  className={`${styles.sideCell} ${isSelected ? styles.sideCellSelected : ''}`}
                  style={{ color: isBuy ? 'var(--positive)' : 'var(--negative)' }}
                >
                  {t.side}
                </td>
                <td className="num" style={{ padding: '5px 12px', textAlign: 'left' }}>
                  {fmtDate(t.date)}
                </td>
                <td className="num" style={{ padding: '5px 12px', textAlign: 'right' }}>
                  {t.quantity.toLocaleString()}
                </td>
                <td className="num" style={{ padding: '5px 12px', textAlign: 'right' }}>
                  ${fmtDollar(t.price)}
                </td>
                <td className="num" style={{ padding: '5px 12px', textAlign: 'right' }}>
                  ${fmtDollar(t.price * t.quantity)}
                </td>
                <td style={{ padding: '5px 12px', textAlign: 'right' }}>
                  <Text variant="monoSm"
                    color={delta >= 0 ? 'var(--positive)' : 'var(--negative)'}
                    style={{ fontSize: 10 }}
                  >
                    {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                  </Text>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
