import type { Trade, Position } from '../../data/types'
import { X } from '@phosphor-icons/react'
import { fmtDollar, fmtDateFull } from '../../lib/format'

interface Props {
  trade: Trade
  position: Position
  onClose: () => void
}

const daysAgo = (iso: string) => {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((now.getTime() - d.getTime()) / 86_400_000)
}

// T+2 settlement, skip weekends
function settlementDate(iso: string): string {
  const d = new Date(iso)
  let count = 0
  while (count < 2) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) count++
  }
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
}

const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  gap: 8,
  padding: '4px 0',
}

const LABEL: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-2)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  flexShrink: 0,
}

const VALUE: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 11,
  color: 'var(--text-1)',
  letterSpacing: '-0.02em',
  textAlign: 'right',
}

const DIVIDER: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  margin: '10px 0',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: 'var(--text-2)',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  marginBottom: 6,
}

export function TradeDetailPanel({ trade, position, onClose }: Props) {
  const isBuy = trade.side === 'BUY'
  const tradeValue = trade.price * trade.quantity
  const priceDelta = ((trade.price - position.avgCost) / position.avgCost) * 100
  const positionShare = (trade.quantity / position.quantity) * 100

  // Est. P&L: meaningful only for SELLs (realised), otherwise unrealised (buy adds to cost basis)
  const estPnl = isBuy ? null : (trade.price - position.avgCost) * trade.quantity

  const age = daysAgo(trade.date)

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
      background: 'var(--surface)',
      padding: '0 0 24px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px 8px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        background: 'var(--surface)',
        zIndex: 1,
      }}>
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>
            Trade detail
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            color: 'var(--accent)',
            letterSpacing: '0.03em',
          }}>
            {trade.tradeId}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
          aria-label="Close trade detail"
        >
          <X size={13} weight="bold" />
        </button>
      </div>

      <div style={{ padding: '12px 12px 0', flex: 1 }}>
        {/* Side + date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: isBuy ? 'var(--positive)' : 'var(--negative)',
            background: isBuy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${isBuy ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            borderRadius: 3,
            padding: '2px 7px',
          }}>
            {trade.side}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtDateFull(trade.date)}</span>
        </div>

        {/* Execution block */}
        <div style={SECTION_LABEL}>Execution</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 1,
          background: 'var(--border)',
          borderRadius: 4,
          overflow: 'hidden',
          marginBottom: 14,
        }}>
          {[
            { label: 'Qty', value: trade.quantity.toLocaleString() },
            { label: 'Price', value: `$${fmtDollar(trade.price)}` },
            { label: 'Value', value: `$${(tradeValue / 1000).toFixed(1)}K` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--bg)',
              padding: '8px 8px 6px',
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}>
              <span style={{ fontSize: 9, color: 'var(--text-2)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                {label}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Position context */}
        <div style={SECTION_LABEL}>Position — {position.ticker}</div>

        <div style={ROW}>
          <span style={LABEL}>Avg cost</span>
          <span style={VALUE}>${fmtDollar(position.avgCost)}</span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>Trade price</span>
          <span style={{ ...VALUE, color: priceDelta >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            ${fmtDollar(trade.price)}{' '}
            <span style={{ fontSize: 10, opacity: 0.8 }}>
              ({priceDelta >= 0 ? '+' : ''}{priceDelta.toFixed(2)}%)
            </span>
          </span>
        </div>

        {estPnl !== null ? (
          <div style={ROW}>
            <span style={LABEL}>Realised P&L</span>
            <span style={{ ...VALUE, color: estPnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
              {estPnl >= 0 ? '+' : ''}${fmtDollar(estPnl)}
            </span>
          </div>
        ) : (
          <div style={ROW}>
            <span style={LABEL}>P&L</span>
            <span style={{ ...VALUE, color: 'var(--text-2)', fontSize: 10 }}>unrealised — adds to basis</span>
          </div>
        )}

        <div style={ROW}>
          <span style={LABEL}>Position share</span>
          <span style={VALUE}>{positionShare.toFixed(1)}%</span>
        </div>

        {/* Position P&L for context */}
        <div style={{ ...ROW, marginTop: 2 }}>
          <span style={LABEL}>Position P&L</span>
          <span style={{ ...VALUE, color: position.pnlDollar >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            {position.pnlDollar >= 0 ? '+' : ''}${fmtDollar(position.pnlDollar)}
          </span>
        </div>

        <div style={DIVIDER} />

        {/* Timeline */}
        <div style={SECTION_LABEL}>Timeline</div>
        <div style={ROW}>
          <span style={LABEL}>Executed</span>
          <span style={{ ...VALUE, color: 'var(--text-2)' }}>
            {age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age}d ago`}
          </span>
        </div>
        <div style={ROW}>
          <span style={LABEL}>Settlement</span>
          <span style={{ ...VALUE, color: 'var(--text-2)' }}>{settlementDate(trade.date)}</span>
        </div>
      </div>
    </div>
  )
}
