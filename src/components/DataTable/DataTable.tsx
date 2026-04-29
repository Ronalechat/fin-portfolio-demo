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
import type { ColumnDef } from '@tanstack/react-table'
import type { Position, Trade } from '../../data/types'
import { portfolioData } from '../../data/generateData'
import { SubTable } from './SubTable'
import styles from './table.module.css'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<Position, any>[]
  filteredIds: Set<number> | null
  globalFilter: string
  selectedTradeId: string | null
  onTradeSelect: (trade: Trade, position: Position) => void
  onTickerHover: (ticker: string | null) => void
  onExpandedTradesChange: (trades: Trade[] | null) => void
}

const DataTableInner = ({
  columns,
  filteredIds,
  globalFilter,
  selectedTradeId,
  onTradeSelect,
  onTickerHover,
  onExpandedTradesChange,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [sorting, setSorting] = useState<SortingState>([])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [columnFilters] = useState<ColumnFiltersState>([])

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
    columns,
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
    <div className={styles.wrapper}>
      {/* Sticky header */}
      <div className={styles.headerBar}>
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
                return (
                  <th
                    key={header.id}
                    title={canSort ? 'Click to sort' : undefined}
                    className={[
                      styles.th,
                      canSort ? styles.thSortable : '',
                      sorted ? styles.thSorted : '',
                      isLeft ? styles.thLeft : styles.thRight,
                    ].join(' ')}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <span className={`${styles.thInner} ${isLeft ? styles.thInnerLeft : styles.thInnerRight}`}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {canSort && sorted === 'asc'  && <CaretUp size={9} weight="bold" />}
                      {canSort && sorted === 'desc' && <CaretDown size={9} weight="bold" />}
                      {canSort && !sorted && (
                        <span style={{ opacity: 0.35, fontSize: 8, lineHeight: 1 }}>⇅</span>
                      )}
                    </span>
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={`${styles.resizeHandle} ${header.column.getIsResizing() ? styles.resizeHandleActive : ''}`}
                        onMouseEnter={(e) => {
                          if (!header.column.getIsResizing())
                            (e.currentTarget as HTMLDivElement).style.background = 'var(--border)'
                        }}
                        onMouseLeave={(e) => {
                          if (!header.column.getIsResizing())
                            (e.currentTarget as HTMLDivElement).style.background = ''
                        }}
                      />
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
        </table>
      </div>

      {/* Empty state */}
      {filteredIds !== null && filteredIds.size === 0 && (
        <div className={styles.emptyState}>
          No trades in selected period — drag the chart to adjust
        </div>
      )}

      {/* Virtualised body */}
      <div
        ref={containerRef}
        className={styles.scrollBody}
        style={{ flex: filteredIds !== null && filteredIds.size === 0 ? 0 : 1 }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            {headers.map((h) => <col key={h.id} style={{ width: h.getSize() }} />)}
          </colgroup>
          <tbody>
            {paddingTop > 0 && (
              <tr><td style={{ height: paddingTop, padding: 0 }} colSpan={columns.length} /></tr>
            )}
            {virtualItems.map((vRow) => {
              const row = rows[vRow.index]
              if (!row) return null

              const id = row.original.id
              const isInFilter = filteredIds === null || filteredIds.has(id)
              const isExpanded = row.getIsExpanded()

              return (
                <tr
                  key={row.id}
                  data-index={vRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{ opacity: isInFilter ? 1 : 0.25, transition: 'opacity 0.2s', cursor: 'pointer' }}
                  onClick={() => row.toggleExpanded()}
                >
                  <td colSpan={columns.length} style={{ padding: 0 }}>
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
                                className={`${styles.td} ${isLeft ? styles.tdLeft : styles.tdRight}`}
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>

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
              <tr><td style={{ height: paddingBottom, padding: 0 }} colSpan={columns.length} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const DataTable = memo(DataTableInner)
