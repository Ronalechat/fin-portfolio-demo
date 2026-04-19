import { useMemo } from 'react'
import { portfolioData } from '../../data/generateData'

export interface PerfDatum {
  date: Date
  pnl: number
}

export interface AttributionDatum {
  ticker: string
  pnlDollar: number
  pnlPercent: number
}

export interface PerformanceData {
  series: PerfDatum[]
  attribution: AttributionDatum[]
}

export function usePerformanceData(periodDays: number): PerformanceData {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Build day series: cumulative unrealised P&L for each day in range.
    // O(M log M + N) sweep: sort positions by first trade date, then walk both
    // arrays in lockstep — O(N days × M positions) would be ~3.65M ops at 10k positions.
    const days: Date[] = Array.from({ length: periodDays }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (periodDays - 1 - i))
      return d
    })

    // Precompute earliest trade date per position, then sort ascending.
    const posEntries = portfolioData
      .map(pos => ({
        firstTrade: pos.trades.reduce((min, t) => (t.date < min ? t.date : min), '9999-99-99'),
        pnlDollar:  pos.pnlDollar,
      }))
      .sort((a, b) => (a.firstTrade < b.firstTrade ? -1 : 1))

    // Single sweep through days: advance posIdx as each position's first trade
    // date falls within the current day. Running total accumulated in pnlSoFar.
    let pnlSoFar = 0
    let posIdx = 0
    const series: PerfDatum[] = days.map((date) => {
      const ds = date.toISOString().slice(0, 10)
      while (posIdx < posEntries.length && posEntries[posIdx].firstTrade <= ds) {
        pnlSoFar += posEntries[posIdx].pnlDollar
        posIdx++
      }
      return { date, pnl: pnlSoFar }
    })

    // Attribution: total P&L and cost per ticker — single O(M) pass.
    const byTicker: Record<string, { pnlDollar: number; totalCost: number }> = {}
    for (const pos of portfolioData) {
      if (!byTicker[pos.ticker]) byTicker[pos.ticker] = { pnlDollar: 0, totalCost: 0 }
      byTicker[pos.ticker].pnlDollar  += pos.pnlDollar
      byTicker[pos.ticker].totalCost  += pos.avgCost * pos.quantity
    }
    const attribution: AttributionDatum[] = Object.entries(byTicker)
      .map(([ticker, { pnlDollar, totalCost }]) => ({
        ticker,
        pnlDollar,
        pnlPercent: totalCost > 0 ? (pnlDollar / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.pnlDollar - a.pnlDollar)

    return { series, attribution }
  }, [periodDays])
}
