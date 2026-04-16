import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ExpandedState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CaretDown, CaretRight, CaretUp } from '@phosphor-icons/react'
import type { Position } from '../../data/types'
import { portfolioData } from '../../data/generateData'
import { SubTable } from './SubTable'

interface Props {
  filteredIds: Set<number> | null
  globalFilter: string
}

const ch = createColumnHelper<Position>()

const fmtDollar = (n: number) =>
  n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const COLUMNS = [
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
    size: 90,
    enableSorting: true,
    cell: (info) => (
      <span
        style={{
          fontWeight: 600,
          fontSize: 12,
          letterSpacing: '0.04em',
          color: 'var(--text-1)',
        }}
      >
        {info.getValue()}
      </span>
    ),
  }),
  ch.accessor('quantity', {
    header: 'Qty',
    size: 90,
    enableSorting: true,
    cell: (info) => (
      <span className="num">{info.getValue().toLocaleString()}</span>
    ),
  }),
  ch.accessor('avgCost', {
    header: 'Avg Cost',
    size: 110,
    enableSorting: true,
    cell: (info) => (
      <span className="num">${fmtDollar(info.getValue())}</span>
    ),
  }),
  ch.accessor('currentPrice', {
    header: 'Curr Price',
    size: 110,
    enableSorting: true,
    cell: (info) => (
      <span className="num">${fmtDollar(info.getValue())}</span>
    ),
  }),
  ch.accessor('pnlDollar', {
    header: 'P&L ($)',
    size: 120,
    enableSorting: true,
    cell: (info) => {
      const v = info.getValue()
      return (
        <span
          className="num"
          style={{ color: v >= 0 ? 'var(--positive)' : 'var(--negative)' }}
        >
          {v >= 0 ? '+' : ''}${fmtDollar(v)}
        </span>
      )
    },
  }),
  ch.accessor('pnlPercent', {
    header: 'P&L (%)',
    size: 100,
    enableSorting: true,
    cell: (info) => {
      const v = info.getValue()
      return (
        <span
          className="num"
          style={{ color: v >= 0 ? 'var(--positive)' : 'var(--negative)' }}
        >
          {v >= 0 ? '+' : ''}
          {v.toFixed(2)}%
        </span>
      )
    },
  }),
]

export function DataTable({ filteredIds, globalFilter }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [columnFilters] = useState<ColumnFiltersState>([])
  const [containerHeight, setContainerHeight] = useState(400)

  useEffect(() => {
    const updateHeight = () => {
      const vh = window.innerHeight
      setContainerHeight(vh - 280 - 40 - 36)
    }
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  const handleExpandedChange = useCallback(
    (updater: ExpandedState | ((prev: ExpandedState) => ExpandedState)) => {
      setExpanded((prev) => {
        const next =
          typeof updater === 'function' ? updater(prev) : updater
        // Only allow one row expanded at a time
        const keys = Object.keys(next).filter((k) => next[k as keyof typeof next])
        if (keys.length <= 1) return next
        const latestKey = keys.find((k) => !prev[k as keyof typeof prev])
        if (!latestKey) return next
        return { [latestKey]: true }
      })
    },
    [],
  )

  const filteredData = useMemo(() => {
    if (!globalFilter) return portfolioData
    const q = globalFilter.toUpperCase()
    return portfolioData.filter((p) => p.ticker.includes(q))
  }, [globalFilter])

  const table = useReactTable({
    data: filteredData,
    columns: COLUMNS,
    state: { sorting, expanded, columnFilters },
    onSortingChange: setSorting,
    onExpandedChange: handleExpandedChange as (
      updater: ExpandedState | ((prev: ExpandedState) => ExpandedState)
    ) => void,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowId: (row) => String(row.id),
  })

  const rows = table.getRowModel().rows

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: (i) => {
      const row = rows[i]
      if (!row) return 36
      if (row.getIsExpanded()) {
        return 36 + row.original.trades.length * 29 + 32
      }
      return 36
    },
    overscan: 10,
    measureElement:
      typeof window !== 'undefined' &&
      navigator.userAgent.indexOf('Firefox') === -1
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  })

  const totalSize = rowVirtualizer.getTotalSize()
  const virtualItems = rowVirtualizer.getVirtualItems()

  const paddingTop =
    virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0

  const headers = table.getFlatHeaders()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Table header (sticky) */}
      <div
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg)',
          flexShrink: 0,
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            {headers.map((h) => (
              <col key={h.id} style={{ width: h.getSize() }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                return (
                  <th
                    key={header.id}
                    style={{
                      padding: '0 12px',
                      height: 32,
                      fontSize: 10,
                      fontWeight: 500,
                      color: canSort && sorted
                        ? 'var(--accent)'
                        : 'var(--text-2)',
                      textAlign:
                        header.id === 'expander' ||
                        header.id === 'ticker'
                          ? 'left'
                          : 'right',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: canSort ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        justifyContent:
                          header.id === 'expander' ||
                          header.id === 'ticker'
                            ? 'flex-start'
                            : 'flex-end',
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {canSort && sorted === 'asc' && (
                        <CaretUp size={9} weight="bold" />
                      )}
                      {canSort && sorted === 'desc' && (
                        <CaretDown size={9} weight="bold" />
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
        </table>
      </div>

      {/* Virtualised body */}
      <div
        ref={containerRef}
        style={{
          height: containerHeight,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <colgroup>
            {headers.map((h) => (
              <col key={h.id} style={{ width: h.getSize() }} />
            ))}
          </colgroup>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td
                  style={{ height: paddingTop, padding: 0 }}
                  colSpan={COLUMNS.length}
                />
              </tr>
            )}
            {virtualItems.map((vRow) => {
              const row = rows[vRow.index]
              if (!row) return null

              const id = row.original.id
              const isInFilter =
                filteredIds === null || filteredIds.has(id)
              const opacity = isInFilter ? 1 : 0.25

              return (
                <tr
                  key={row.id}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    opacity,
                    transition: 'opacity 0.2s',
                    cursor: 'pointer',
                  }}
                  onClick={() => row.toggleExpanded()}
                >
                  <td colSpan={COLUMNS.length} style={{ padding: 0 }}>
                    {/* Main row */}
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        tableLayout: 'fixed',
                        borderBottom: row.getIsExpanded()
                          ? 'none'
                          : '1px solid var(--border)',
                      }}
                    >
                      <colgroup>
                        {headers.map((h) => (
                          <col
                            key={h.id}
                            style={{ width: h.getSize() }}
                          />
                        ))}
                      </colgroup>
                      <tbody>
                        <tr
                          style={{
                            background: row.getIsExpanded()
                              ? 'var(--surface)'
                              : 'transparent',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => {
                            if (!row.getIsExpanded()) {
                              ;(
                                e.currentTarget as HTMLTableRowElement
                              ).style.background =
                                'rgba(255,255,255,0.03)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!row.getIsExpanded()) {
                              ;(
                                e.currentTarget as HTMLTableRowElement
                              ).style.background = 'transparent'
                            }
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              style={{
                                padding: '0 12px',
                                height: 36,
                                textAlign:
                                  cell.column.id === 'expander' ||
                                  cell.column.id === 'ticker'
                                    ? 'left'
                                    : 'right',
                                verticalAlign: 'middle',
                              }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>

                    {/* Expanded sub-table */}
                    {row.getIsExpanded() && (
                      <SubTable trades={row.original.trades} />
                    )}
                  </td>
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr>
                <td
                  style={{ height: paddingBottom, padding: 0 }}
                  colSpan={COLUMNS.length}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
