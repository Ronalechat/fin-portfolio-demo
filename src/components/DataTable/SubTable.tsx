import { useState } from 'react'
import type { Trade, Position } from '../../data/types'
import { fmtDate, fmtDollar } from '../../lib/format'

interface Props {
  trades: Trade[]
  position: Position
  selectedTradeId: string | null
  onTradeSelect: (trade: Trade) => void
}

type SortKey = 'date' | 'qty' | 'price' | 'value' | 'delta'
interface SortState { key: SortKey; desc: boolean }

// ─── Tiny sort caret ──────────────────────────────────────────────────────────

function SortIcon({ col, sort }: { col: SortKey; sort: SortState | null }) {
  if (!sort || sort.key !== col) {
    return <span style={{ opacity: 0.3, fontSize: 8 }}>⇅</span>
  }
  return (
    <span style={{ fontSize: 9, color: 'var(--accent)' }}>
      {sort.desc ? '↓' : '↑'}
    </span>
  )
}

// ─── Analytics header ─────────────────────────────────────────────────────────

function PositionSummary({ trades }: { trades: Trade[] }) {
  let buyCount = 0, sellCount = 0, buyValue = 0, sellValue = 0
  for (const t of trades) {
    const val = t.price * t.quantity
    if (t.side === 'BUY') { buyCount++; buyValue += val }
    else { sellCount++; sellValue += val }
  }
  const totalValue = buyValue + sellValue
  const buyRatio = totalValue > 0 ? (buyValue / totalValue) * 100 : 50

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 12px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--positive)' }}>
          {buyCount} BUY
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-2)' }}>·</span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--negative)' }}>
          {sellCount} SELL
        </span>
      </div>

      <div style={{
        flex: 1, height: 4, borderRadius: 2, overflow: 'hidden',
        background: 'rgba(239,68,68,0.3)', maxWidth: 80,
      }}>
        <div style={{
          width: `${buyRatio}%`, height: '100%',
          background: 'rgba(34,197,94,0.5)', borderRadius: 2,
        }} />
      </div>

      <div style={{
        marginLeft: 'auto',
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10, color: 'var(--text-2)', letterSpacing: '-0.02em', flexShrink: 0,
      }}>
        ${(totalValue / 1000).toFixed(1)}K traded
      </div>
    </div>
  )
}

// ─── SubTable ─────────────────────────────────────────────────────────────────

const COLS: { key: SortKey; label: string; align: 'left' | 'right'; width: string }[] = [
  { key: 'date',  label: 'Date',   align: 'left',  width: '20%' },
  { key: 'qty',   label: 'Qty',    align: 'right', width: '13%' },
  { key: 'price', label: 'Price',  align: 'right', width: '17%' },
  { key: 'value', label: 'Value',  align: 'right', width: '17%' },
  { key: 'delta', label: 'vs Avg', align: 'right', width: '17%' },
]

// Side column is not sortable — kept static
const SIDE_WIDTH = '16%'

function sortTrades(trades: Trade[], sort: SortState | null, avgCost: number): Trade[] {
  if (!sort) return trades
  const sorted = [...trades].sort((a, b) => {
    switch (sort.key) {
      case 'date':  return a.date.localeCompare(b.date)
      case 'qty':   return a.quantity - b.quantity
      case 'price': return a.price - b.price
      case 'value': return (a.price * a.quantity) - (b.price * b.quantity)
      case 'delta': {
        const da = ((a.price - avgCost) / avgCost)
        const db = ((b.price - avgCost) / avgCost)
        return da - db
      }
    }
  })
  return sort.desc ? sorted.reverse() : sorted
}

export function SubTable({ trades, position, selectedTradeId, onTradeSelect }: Props) {
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
    <div style={{
      background: 'var(--bg)',
      borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
    }}>
      <PositionSummary trades={trades} />

      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {/* Side — not sortable */}
            <th
              style={{
                padding: '5px 12px',
                fontSize: 10,
                fontWeight: 400,
                fontStyle: 'italic',
                color: '#444',
                textAlign: 'left',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                width: SIDE_WIDTH,
                cursor: 'default',
                userSelect: 'none',
              }}
            >
              Side
            </th>

            {COLS.map(({ key, label, align, width }) => {
              const active = sort?.key === key
              return (
                <th
                  key={key}
                  onClick={(e) => { e.stopPropagation(); handleHeaderClick(key) }}
                  style={{
                    padding: '5px 12px',
                    fontSize: 10,
                    fontWeight: 500,
                    color: active ? 'var(--accent)' : 'var(--text-2)',
                    textAlign: align,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    width,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
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
                style={{
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                {/* Side — accent left border when selected */}
                <td style={{
                  padding: '5px 10px 5px 10px',
                  textAlign: 'left',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: isBuy ? 'var(--positive)' : 'var(--negative)',
                  borderLeft: isSelected
                    ? '2px solid var(--accent)'
                    : '2px solid transparent',
                  transition: 'border-color 0.15s',
                }}>
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
                <td style={{
                  padding: '5px 12px', textAlign: 'right',
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 10, letterSpacing: '-0.02em',
                  color: delta >= 0 ? 'var(--positive)' : 'var(--negative)',
                }}>
                  {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
