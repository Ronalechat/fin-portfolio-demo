import { useMemo } from 'react'
import { portfolioData, TOTAL_PORTFOLIO_VALUE } from '../data/generateData'

interface Props {
  filteredIds: Set<number> | null
  dateRange: [Date, Date] | null
  globalFilter: string
}

const NUM: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  letterSpacing: '-0.02em',
}

function fmt(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })
}

export function StatStrip({ filteredIds, dateRange, globalFilter }: Props) {
  const stats = useMemo(() => {
    // Global stats — always computed
    const totalPnl = portfolioData.reduce((s, p) => s + p.pnlDollar, 0)

    if (globalFilter) {
      const q = globalFilter.toUpperCase()
      const matched = portfolioData.filter((p) => p.ticker.includes(q))
      return { mode: 'search' as const, count: matched.length, query: globalFilter.toUpperCase() }
    }

    if (!filteredIds) {
      // No brush — show global portfolio summary
      return {
        mode: 'global' as const,
        count: portfolioData.length,
        aum: TOTAL_PORTFOLIO_VALUE,
        pnl: totalPnl,
      }
    }

    // Brush active — show what's inside the selection
    const filteredPositions = portfolioData.filter((p) => filteredIds.has(p.id))
    let volume = 0
    let buyVol = 0
    let sellVol = 0

    for (const pos of filteredPositions) {
      for (const trade of pos.trades) {
        if (!dateRange) continue
        const d = new Date(trade.date)
        if (d >= dateRange[0] && d <= dateRange[1]) {
          const v = trade.price * trade.quantity
          volume += v
          if (trade.side === 'BUY') buyVol += v
          else sellVol += v
        }
      }
    }

    return {
      mode: 'brush' as const,
      count: filteredPositions.length,
      volume,
      netSide: buyVol >= sellVol ? 'BUY' : 'SELL',
      dateRange,
    }
  }, [filteredIds, dateRange, globalFilter])

  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    padding: '0 12px',
    height: 28,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg)',
    flexShrink: 0,
    fontSize: 11,
    color: 'var(--text-2)',
    fontFamily: 'ui-sans-serif, system-ui',
    letterSpacing: '0.01em',
    overflow: 'hidden',
  }

  if (stats.mode === 'search') {
    return (
      <div style={base}>
        <span>
          <span style={{ ...NUM, color: 'var(--text-1)' }}>{stats.count.toLocaleString()}</span>
          {' '}positions matching{' '}
          <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{stats.query}</span>
        </span>
      </div>
    )
  }

  if (stats.mode === 'global') {
    return (
      <div style={base}>
        <span>
          <span style={{ ...NUM, color: 'var(--text-1)' }}>{stats.count.toLocaleString()}</span>
          {' '}positions
        </span>
        <Dot />
        <span>
          AUM{' '}
          <span style={{ ...NUM, color: 'var(--text-1)' }}>{fmt(stats.aum)}</span>
        </span>
        <Dot />
        <span>
          Unrealised{' '}
          <span style={{ ...NUM, color: stats.pnl >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
            {stats.pnl >= 0 ? '+' : ''}{fmt(stats.pnl)}
          </span>
        </span>
      </div>
    )
  }

  // Brush mode
  return (
    <div style={base}>
      <span>
        <span style={{ ...NUM, color: 'var(--accent)' }}>{stats.count.toLocaleString()}</span>
        {' '}positions in range
      </span>
      {stats.dateRange && (
        <>
          <Dot />
          <span style={{ ...NUM, color: 'var(--text-2)', fontSize: 10 }}>
            {fmtDate(stats.dateRange[0])} – {fmtDate(stats.dateRange[1])}
          </span>
        </>
      )}
      <Dot />
      <span>
        <span style={{ ...NUM, color: 'var(--text-1)' }}>{fmt(stats.volume)}</span>
        {' '}volume
      </span>
      <Dot />
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.06em',
        color: stats.netSide === 'BUY' ? 'var(--positive)' : 'var(--negative)',
      }}>
        net {stats.netSide}
      </span>
    </div>
  )
}

function Dot() {
  return <span style={{ color: 'var(--border)', fontSize: 10 }}>·</span>
}
