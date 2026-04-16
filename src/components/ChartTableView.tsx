import { useState, useMemo } from 'react'
import { PortfolioChart } from './PortfolioChart'
import { DataTable } from './DataTable'
import { portfolioData } from '../data/generateData'

export function ChartTableView() {
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(null)
  const [globalFilter, setGlobalFilter] = useState('')

  const filteredIds = useMemo<Set<number> | null>(() => {
    if (!dateRange) return null
    const [start, end] = dateRange
    const ids = new Set<number>()
    for (const pos of portfolioData) {
      for (const trade of pos.trades) {
        const d = new Date(trade.date)
        if (d >= start && d <= end) {
          ids.add(pos.id)
          break
        }
      }
    }
    return ids
  }, [dateRange])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <PortfolioChart
        onBrush={setDateRange}
        hasBrush={dateRange !== null}
      />

      {/* Table toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            style={{
              position: 'absolute',
              left: 8,
              color: 'var(--text-2)',
              pointerEvents: 'none',
            }}
          >
            <circle
              cx="6.5"
              cy="6.5"
              r="4.5"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M10.5 10.5L14 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter by ticker…"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color: 'var(--text-1)',
              fontFamily: 'ui-sans-serif, system-ui',
              fontSize: 11,
              padding: '4px 8px 4px 26px',
              width: 160,
              outline: 'none',
              letterSpacing: '0.02em',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          />
        </div>

        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--text-2)',
            fontFamily: 'ui-sans-serif, system-ui',
            letterSpacing: '0.04em',
          }}
        >
          {dateRange
            ? `Filtered · ${portfolioData.filter((p) =>
                filteredIds?.has(p.id),
              ).length} positions`
            : `500 positions`}
        </span>
      </div>

      <DataTable filteredIds={filteredIds} globalFilter={globalFilter} />
    </div>
  )
}
