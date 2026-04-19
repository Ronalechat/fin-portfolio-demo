import { useMemo } from 'react'
import * as d3 from 'd3'
import { portfolioData } from '../../data/generateData'

export interface DayDatum {
  date: Date
  dateStr: string
  [ticker: string]: number | Date | string
}

export interface ChartData {
  days: Date[]
  keys: string[]
  stackedData: d3.Series<DayDatum, string>[]
  colorScale: d3.ScaleOrdinal<string, string>
  data: DayDatum[]
  dayDataMap: Map<string, DayDatum>
}

export const PERIOD_OPTIONS = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
] as const

export type PeriodDays = typeof PERIOD_OPTIONS[number]['days']

export function useChartData(periodDays: number): ChartData {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const days: Date[] = Array.from({ length: periodDays }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (periodDays - 1 - i))
      return d
    })

    const dayStrings = days.map((d) => d.toISOString().slice(0, 10))
    // Set for O(1) lookup — critical at 10k positions × ~9 trades each
    const daySet = new Set(dayStrings)

    // Sum value per ticker per day (using trades as anchors)
    const valueByTickerDay: Record<string, Record<string, number>> = {}

    for (const pos of portfolioData) {
      if (!valueByTickerDay[pos.ticker]) valueByTickerDay[pos.ticker] = {}
      for (const trade of pos.trades) {
        if (daySet.has(trade.date)) {
          const prev = valueByTickerDay[pos.ticker][trade.date] ?? 0
          valueByTickerDay[pos.ticker][trade.date] =
            prev + pos.currentPrice * pos.quantity
        }
      }
    }

    // Top 5 tickers by total value
    const totalByTicker: Record<string, number> = {}
    for (const [ticker, byDay] of Object.entries(valueByTickerDay)) {
      totalByTicker[ticker] = Object.values(byDay).reduce((a, b) => a + b, 0)
    }

    const sorted = Object.entries(totalByTicker)
      .sort((a, b) => b[1] - a[1])
      .map(([t]) => t)

    const top5 = sorted.slice(0, 5)
    const keys = [...top5, 'Other']

    // Build per-day data
    const data: DayDatum[] = days.map((date) => {
      const ds = date.toISOString().slice(0, 10)
      const row: DayDatum = { date, dateStr: ds }

      let otherVal = 0
      for (const [ticker, byDay] of Object.entries(valueByTickerDay)) {
        const val = byDay[ds] ?? 0
        if (top5.includes(ticker)) {
          row[ticker] = ((row[ticker] as number) ?? 0) + val
        } else {
          otherVal += val
        }
      }
      row['Other'] = otherVal

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

    const dayDataMap = new Map(data.map((d) => [d.dateStr, d]))

    return { days, keys, stackedData, colorScale, data, dayDataMap }
  }, [periodDays])
}
