import { useMemo } from 'react'
import { portfolioData, TOTAL_PORTFOLIO_VALUE } from '../data/generateData'
import { Box } from './ui/Box'
import { Text } from './ui/Text'

interface Props {
  filteredIds: Set<number> | null
  dateRange: [Date, Date] | null
  globalFilter: string
}

const fmt = (n: number): string => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${(n / 1e3).toFixed(0)}K`
}

const fmtDate = (d: Date): string =>
  d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' })

const Dot = () => <Text variant="caption" color="var(--border)">·</Text>

export const StatStrip = ({ filteredIds, dateRange, globalFilter }: Props) => {
  const stats = useMemo(() => {
    const totalPnl = portfolioData.reduce((s, p) => s + p.pnlDollar, 0)

    if (globalFilter) {
      const q = globalFilter.toUpperCase()
      const matched = portfolioData.filter((p) => p.ticker.includes(q))
      return { mode: 'search' as const, count: matched.length, query: globalFilter.toUpperCase() }
    }

    if (!filteredIds) {
      return {
        mode: 'global' as const,
        count: portfolioData.length,
        aum: TOTAL_PORTFOLIO_VALUE,
        pnl: totalPnl,
      }
    }

    const filteredPositions = portfolioData.filter((p) => filteredIds.has(p.id))
    let volume = 0, buyVol = 0, sellVol = 0

    const startStr = dateRange ? dateRange[0].toISOString().slice(0, 10) : null
    const endStr   = dateRange ? dateRange[1].toISOString().slice(0, 10) : null

    for (const pos of filteredPositions) {
      for (const trade of pos.trades) {
        if (!startStr || !endStr) continue
        if (trade.date >= startStr && trade.date <= endStr) {
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

  return (
    <Box
      display="flex" alignItems="center" gap={20}
      style={{
        padding: '0 12px',
        height: 28,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {stats.mode === 'search' && (
        <Text variant="caption">
          <Text variant="mono" color="var(--text-1)">{stats.count.toLocaleString()}</Text>
          {' '}positions matching{' '}
          <Text variant="caption" color="var(--accent)" weight={500}>{stats.query}</Text>
        </Text>
      )}

      {stats.mode === 'global' && <>
        <Text variant="caption">
          <Text variant="mono" color="var(--text-1)">{stats.count.toLocaleString()}</Text>
          {' '}positions
        </Text>
        <Dot />
        <Text variant="caption">
          AUM <Text variant="mono" color="var(--text-1)">{fmt(stats.aum)}</Text>
        </Text>
        <Dot />
        <Text variant="caption">
          Unrealised{' '}
          <Text variant="mono" color={stats.pnl >= 0 ? 'var(--positive)' : 'var(--negative)'}>
            {stats.pnl >= 0 ? '+' : ''}{fmt(stats.pnl)}
          </Text>
        </Text>
      </>}

      {stats.mode === 'brush' && <>
        <Text variant="caption">
          <Text variant="mono" color="var(--accent)">{stats.count.toLocaleString()}</Text>
          {' '}positions in range
        </Text>
        {stats.dateRange && <>
          <Dot />
          <Text variant="monoSm">
            {fmtDate(stats.dateRange[0])} – {fmtDate(stats.dateRange[1])}
          </Text>
        </>}
        <Dot />
        <Text variant="caption">
          <Text variant="mono" color="var(--text-1)">{fmt(stats.volume)}</Text>
          {' '}volume
        </Text>
        <Dot />
        <Text variant="label" color={stats.netSide === 'BUY' ? 'var(--positive)' : 'var(--negative)'}>
          net {stats.netSide}
        </Text>
      </>}
    </Box>
  )
}
