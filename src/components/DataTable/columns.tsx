import { createColumnHelper } from '@tanstack/react-table'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import type { Position } from '../../data/types'
import { TOTAL_PORTFOLIO_VALUE } from '../../data/generateData'
import { fmtDollar, fmtK } from '../../lib/format'
import { Sparkline } from './Sparkline'

const ch = createColumnHelper<Position>()

export const COLUMNS = [
  ch.display({
    id: 'expander',
    size: 36,
    header: () => null,
    cell: ({ row }) => (
      <button
        onClick={(e) => {
          e.stopPropagation()
          row.toggleExpanded()
        }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-2)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          width: 20,
          height: 20,
          transition: 'color 0.15s',
        }}
        aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
      >
        {row.getIsExpanded() ? (
          <CaretDown size={11} weight="bold" />
        ) : (
          <CaretRight size={11} weight="bold" />
        )}
      </button>
    ),
  }),
  ch.accessor('ticker', {
    header: 'Ticker',
    size: 88,
    enableSorting: true,
    cell: (info) => (
      <span style={{ fontWeight: 600, fontSize: 12, letterSpacing: '0.04em', color: 'var(--text-1)' }}>
        {info.getValue()}
      </span>
    ),
  }),
  ch.display({
    id: 'tradeCount',
    header: 'Trades',
    size: 60,
    cell: ({ row }) => (
      <span style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 11,
        color: 'var(--text-2)',
        letterSpacing: '-0.02em',
      }}>
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
      <Sparkline
        trades={row.original.trades}
        pnlDollar={row.original.pnlDollar}
      />
    ),
  }),
]
