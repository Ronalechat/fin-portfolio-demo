import type { Trade } from '../../data/types'

interface Props {
  trades: Trade[]
}

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  })
}

const fmtPrice = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function SubTable({ trades }: Props) {
  return (
    <div
      style={{
        background: 'var(--bg)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr
            style={{
              borderBottom: '1px solid var(--border)',
            }}
          >
            {['Date', 'Side', 'Qty', 'Price', 'Value'].map((h, i) => (
              <th
                key={h}
                style={{
                  padding: '4px 12px',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'var(--text-2)',
                  textAlign: i === 0 ? 'left' : 'right',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  width: i === 0 ? '22%' : i === 1 ? '14%' : '21%',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const isBuy = t.side === 'BUY'
            return (
              <tr
                key={t.tradeId}
                style={{
                  background: isBuy
                    ? 'rgba(34, 197, 94, 0.04)'
                    : 'rgba(239, 68, 68, 0.04)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <td
                  className="num"
                  style={{ padding: '5px 12px', textAlign: 'left' }}
                >
                  {fmtDate(t.date)}
                </td>
                <td
                  style={{
                    padding: '5px 12px',
                    textAlign: 'right',
                    fontSize: 11,
                    fontWeight: 600,
                    color: isBuy ? 'var(--positive)' : 'var(--negative)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t.side}
                </td>
                <td
                  className="num"
                  style={{ padding: '5px 12px', textAlign: 'right' }}
                >
                  {t.quantity.toLocaleString()}
                </td>
                <td
                  className="num"
                  style={{ padding: '5px 12px', textAlign: 'right' }}
                >
                  ${fmtPrice(t.price)}
                </td>
                <td
                  className="num"
                  style={{ padding: '5px 12px', textAlign: 'right' }}
                >
                  ${fmtPrice(t.price * t.quantity)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
