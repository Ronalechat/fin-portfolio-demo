import {
  useRef,
  useState,
  useCallback,
  useMemo,
  useLayoutEffect,
  memo,
} from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  type SortingState,
  type ExpandedState,
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import type { Position, Trade } from '../../data/types'
import { portfolioData } from '../../data/generateData'
import { SubTable } from './SubTable'
import { COLUMNS } from './columns'

interface Props {
  filteredIds: Set<number> | null
  globalFilter: string
  selectedTradeId: string | null
  onTradeSelect: (trade: Trade, position: Position) => void
  onTickerHover: (ticker: string | null) => void
  onExpandedTradesChange: (trades: Trade[] | null) => void
}

function DataTableInner({ filteredIds, globalFilter, selectedTradeId, onTradeSelect, onTickerHover, onExpandedTradesChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [columnFilters] = useState<ColumnFiltersState>([])

  // The scroll container uses flex:1 so the browser controls its height.
  // No ResizeObserver needed — the virtualizer reads the element height directly.

  const handleExpandedChange = useCallback(
    (updater: ExpandedState | ((prev: ExpandedState) => ExpandedState)) => {
      setExpanded((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        const keys = Object.keys(next).filter((k) => next[k as keyof typeof next])
        if (keys.length <= 1) return next
        const latestKey = keys.find((k) => !prev[k as keyof typeof prev])
        if (!latestKey) return next
        return { [latestKey]: true }
      })
    },
    [],
  )

  // 2D — tell the chart which trades to show as tick marks when a row is expanded.
  // Row IDs are String(position.id), so we can resolve back to portfolioData directly
  // without needing to access `table` here (which isn't defined yet at this point).
  useLayoutEffect(() => {
    const expandedKeys = Object.keys(expanded).filter(
      (k) => expanded[k as keyof typeof expanded],
    )
    if (expandedKeys.length === 1) {
      const posId = parseInt(expandedKeys[0], 10)
      const pos = portfolioData.find((p) => p.id === posId)
      onExpandedTradesChange(pos?.trades ?? null)
    } else {
      onExpandedTradesChange(null)
    }
  }, [expanded, onExpandedTradesChange])

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
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
  })

  const rows = table.getRowModel().rows

  // Memoised so TanStack Virtual doesn't re-estimate all 5,000 rows when the
  // DataTable re-renders due to unrelated parent state changes (e.g. sort toggle).
  const estimateSize = useCallback(
    (i: number) => {
      const row = rows[i]
      if (!row) return 36
      if (row.getIsExpanded()) {
        return 36 + row.original.trades.length * 30 + 56 + 36
      }
      return 36
    },
    [rows],
  )

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan: 10,
    measureElement:
      typeof window !== 'undefined' && navigator.userAgent.indexOf('Firefox') === -1
        ? (el) => el.getBoundingClientRect().height
        : undefined,
  })

  const totalSize = rowVirtualizer.getTotalSize()
  const virtualItems = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]?.start ?? 0 : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)
      : 0

  const headers = table.getFlatHeaders()

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      {/* Sticky header */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)', flexShrink: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {headers.map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>
          <thead>
            <tr>
              {headers.map((header) => {
                const canSort = header.column.getCanSort()
                const sorted = header.column.getIsSorted()
                const isLeft = header.id === 'expander' || header.id === 'ticker'
                const color = sorted
                  ? 'var(--accent)'
                  : canSort
                  ? 'var(--text-2)'
                  : '#444'
                return (
                  <th
                    key={header.id}
                    title={canSort ? 'Click to sort' : undefined}
                    style={{
                      position: 'relative',
                      padding: '0 12px',
                      height: 32,
                      fontSize: 10,
                      fontWeight: canSort ? 500 : 400,
                      fontStyle: canSort ? 'normal' : 'italic',
                      color,
                      textAlign: isLeft ? 'left' : 'right',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      cursor: canSort ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                      justifyContent: isLeft ? 'flex-start' : 'flex-end',
                    }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && sorted === 'asc' && <CaretUp size={9} weight="bold" />}
                      {canSort && sorted === 'desc' && <CaretDown size={9} weight="bold" />}
                      {canSort && !sorted && (
                        <span style={{ opacity: 0.35, fontSize: 8, lineHeight: 1 }}>⇅</span>
                      )}
                    </span>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          height: '100%',
                          width: 4,
                          cursor: 'col-resize',
                          userSelect: 'none',
                          touchAction: 'none',
                          background: header.column.getIsResizing()
                            ? 'var(--accent)'
                            : 'transparent',
                        }}
                        onMouseEnter={(e) => { if (!header.column.getIsResizing()) (e.currentTarget as HTMLDivElement).style.background = 'var(--border)' }}
                        onMouseLeave={(e) => { if (!header.column.getIsResizing()) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
        </table>
      </div>

      {/* Empty state — brush active but no trades fall in the selected window */}
      {filteredIds !== null && filteredIds.size === 0 && (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-2)',
          fontSize: 11,
          fontStyle: 'italic',
          letterSpacing: '0.03em',
        }}>
          No trades in selected period — drag the chart to adjust
        </div>
      )}

      {/* Virtualised body — flex:1 fills remaining height; ResizeObserver reads the result */}
      <div
        ref={containerRef}
        style={{ flex: filteredIds !== null && filteredIds.size === 0 ? 0 : 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {headers.map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>
          <tbody>
            {paddingTop > 0 && (
              <tr><td style={{ height: paddingTop, padding: 0 }} colSpan={COLUMNS.length} /></tr>
            )}
            {virtualItems.map((vRow) => {
              const row = rows[vRow.index]
              if (!row) return null

              const id = row.original.id
              const isInFilter = filteredIds === null || filteredIds.has(id)
              const opacity = isInFilter ? 1 : 0.25
              const isExpanded = row.getIsExpanded()

              return (
                <tr
                  key={row.id}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ opacity, transition: 'opacity 0.2s', cursor: 'pointer' }}
                  onClick={() => row.toggleExpanded()}
                >
                  <td colSpan={COLUMNS.length} style={{ padding: 0 }}>
                    {/* Main position row — CSS handles hover; className drives expanded state */}
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      tableLayout: 'fixed',
                      borderBottom: isExpanded ? 'none' : '1px solid var(--border)',
                    }}>
                      <colgroup>
                        {headers.map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
                      </colgroup>
                      <tbody>
                        <tr
                          className={isExpanded ? 'row-position is-expanded' : 'row-position'}
                          onMouseEnter={() => onTickerHover(row.original.ticker)}
                          onMouseLeave={() => onTickerHover(null)}
                        >
                          {row.getVisibleCells().map((cell) => {
                            const isLeft =
                              cell.column.id === 'expander' || cell.column.id === 'ticker'
                            return (
                              <td
                                key={cell.id}
                                style={{
                                  padding: '0 12px',
                                  height: 36,
                                  textAlign: isLeft ? 'left' : 'right',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>

                    {/* Expanded sub-table */}
                    {isExpanded && (
                      <SubTable
                        trades={row.original.trades}
                        position={row.original}
                        selectedTradeId={selectedTradeId}
                        onTradeSelect={(trade) => onTradeSelect(trade, row.original)}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
            {paddingBottom > 0 && (
              <tr><td style={{ height: paddingBottom, padding: 0 }} colSpan={COLUMNS.length} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// memo: DataTable only re-renders when its own props change.
// Without this, every hoveredTicker update in ChartTableView (60x/sec during
// row scrolling) caused DataTable to re-render → useReactTable (5k rows) +
// useVirtualizer to run → 5-10ms per hover event → visible freeze.
export const DataTable = memo(DataTableInner)
