import { useMemo } from 'react'
import * as d3 from 'd3'
import { portfolioData } from '../../data/generateData'

export interface DayDatum {
  date: Date
  [ticker: string]: number | Date
}

export interface ChartData {
  days: Date[]
  keys: string[]
  stackedData: d3.Series<DayDatum, string>[]
  colorScale: d3.ScaleOrdinal<string, string>
}

export function useChartData(): ChartData {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days: Date[] = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (29 - i))
      return d
    })

    const dayStrings = days.map((d) => d.toISOString().slice(0, 10))

    // Sum value per ticker per day (using trades as anchors)
    const valueByTickerDay: Record<string, Record<string, number>> = {}

    for (const pos of portfolioData) {
      if (!valueByTickerDay[pos.ticker]) {
        valueByTickerDay[pos.ticker] = {}
      }
      for (const trade of pos.trades) {
        if (dayStrings.includes(trade.date)) {
          const prev = valueByTickerDay[pos.ticker][trade.date] ?? 0
          valueByTickerDay[pos.ticker][trade.date] =
            prev + pos.currentPrice * pos.quantity
        }
      }
    }

    // Top 5 tickers by total value
    const totalByTicker: Record<string, number> = {}
    for (const [ticker, byDay] of Object.entries(valueByTickerDay)) {
      totalByTicker[ticker] = Object.values(byDay).reduce(
        (a, b) => a + b,
        0,
      )
    }

    const sorted = Object.entries(totalByTicker)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)

    const top5 = sorted.slice(0, 5)
    const keys = [...top5, 'Other']

    // Build per-day data
    const data: DayDatum[] = days.map((date) => {
      const ds = date.toISOString().slice(0, 10)
      const row: DayDatum = { date }

      let otherVal = 0
      for (const [ticker, byDay] of Object.entries(valueByTickerDay)) {
        const val = byDay[ds] ?? 0
        if (top5.includes(ticker)) {
          row[ticker] = (row[ticker] as number ?? 0) + val
        } else {
          otherVal += val
        }
      }
      row['Other'] = otherVal

      // Ensure all keys present
      for (const k of keys) {
        if (!(k in row)) row[k] = 0
      }

      return row
    })

    const stackedData = d3
      .stack<DayDatum>()
      .keys(keys)
      .value((d, key) => (d[key] as number) ?? 0)(data)

    const colorScale = d3
      .scaleOrdinal<string, string>()
      .domain(keys)
      .range(d3.schemeTableau10 as string[])

    return { days, keys, stackedData, colorScale }
  }, [])
}
