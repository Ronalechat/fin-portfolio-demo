import { createColumnHelper } from '@tanstack/react-table'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { Position } from '../../data/types'
import { TOTAL_PORTFOLIO_VALUE } from '../../data/generateData'
import { fmtDollar, fmtK } from '../../lib/format'
import { Sparkline } from './Sparkline'
import styles from './table.module.css'

const ch = createColumnHelper<Position>()

const expanderCol = ch.display({
  id: 'expander',
  size: 36,
  header: () => null,
  cell: ({ row }) => (
    <button
      onClick={(e) => { e.stopPropagation(); row.toggleExpanded() }}
      className={styles.expandBtn}
      aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
    >
      {row.getIsExpanded() ? (
        <CaretDown size={11} weight="bold" />
      ) : (
        <CaretRight size={11} weight="bold" />
      )}
    </button>
  ),
})

const tickerCol = ch.accessor('ticker', {
  header: 'Ticker',
  size: 88,
  enableSorting: true,
  cell: (info) => (
    <span className={styles.tickerCell}>{info.getValue()}</span>
  ),
})

const tickerColWide = ch.accessor('ticker', {
  id: 'ticker',
  header: 'Ticker',
  size: 120,
  enableSorting: true,
  cell: (info) => (
    <span className={styles.tickerCell}>{info.getValue()}</span>
  ),
})

export const COLUMNS = [
  expanderCol,
  tickerCol,
  ch.display({
    id: 'tradeCount',
    header: 'Trades',
    size: 60,
    cell: ({ row }) => (
      <span className="num" style={{ color: 'var(--text-2)' }}>
        {row.original.trades.length}
      </span>
    ),
  }),
  ch.accessor('quantity', {
    header: 'Qty',
    size: 80,
    enableSorting: true,
    cell: (info) => <span className="num">{info.getValue().toLocaleString()}</span>,
  }),
  ch.accessor('avgCost', {
    header: 'Avg Cost',
    size: 100,
    enableSorting: true,
    cell: (info) => <span className="num">${fmtDollar(info.getValue())}</span>,
  }),
  ch.accessor('currentPrice', {
    header: 'Curr Price',
    size: 100,
    enableSorting: true,
    cell: (info) => <span className="num">${fmtDollar(info.getValue())}</span>,
  }),
  ch.display({
    id: 'mktValue',
    header: 'Mkt Val',
    size: 110,
    cell: ({ row }) => {
      const val = row.original.currentPrice * row.original.quantity
      return <span className="num">${fmtK(val)}</span>
    },
  }),
  ch.accessor('pnlDollar', {
    header: 'P&L ($)',
    size: 110,
    enableSorting: true,
    cell: (info) => {
      const v = info.getValue()
      return (
        <span className="num" style={{ color: v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
          {v >= 0 ? '+' : ''}${fmtDollar(v)}
        </span>
      )
    },
  }),
  ch.accessor('pnlPercent', {
    header: 'P&L (%)',
    size: 90,
    enableSorting: true,
    cell: (info) => {
      const v = info.getValue()
      return (
        <span className="num" style={{ color: v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}%
        </span>
      )
    },
  }),
  ch.display({
    id: 'weight',
    header: 'Weight',
    size: 80,
    cell: ({ row }) => {
      const mktVal = row.original.currentPrice * row.original.quantity
      const weight = (mktVal / TOTAL_PORTFOLIO_VALUE) * 100
      return (
        <span className="num" style={{ color: 'var(--text-2)' }}>
          {weight.toFixed(2)}%
        </span>
      )
    },
  }),
  ch.display({
    id: 'trend',
    header: 'Trend',
    size: 72,
    cell: ({ row }) => (
      <Sparkline trades={row.original.trades} pnlDollar={row.original.pnlDollar} />
    ),
  }),
]

export const MOBILE_COLUMNS = [
  expanderCol,
  tickerColWide,
  ch.accessor('pnlDollar', {
    id: 'pnlDollar',
    header: 'P&L ($)',
    size: 110,
    enableSorting: true,
    cell: (info) => {
      const v = info.getValue()
      return (
        <span className="num" style={{ color: v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
          {v >= 0 ? '+' : ''}${fmtDollar(v)}
        </span>
      )
    },
  }),
  ch.accessor('pnlPercent', {
    id: 'pnlPercent',
    header: 'P&L (%)',
    size: 90,
    enableSorting: true,
    cell: (info) => {
      const v = info.getValue()
      return (
        <span className="num" style={{ color: v >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}%
        </span>
      )
    },
  }),
  ch.display({
    id: 'trend',
    header: 'Trend',
    size: 72,
    cell: ({ row }) => (
      <Sparkline trades={row.original.trades} pnlDollar={row.original.pnlDollar} />
    ),
  }),
]
