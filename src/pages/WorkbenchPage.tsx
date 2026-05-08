import { useState, useEffect, useMemo } from 'react'
import { ChartTableView } from '../components/ChartTableView'
import { MobilePositionList } from '../components/DataTable/MobilePositionList'
import { PortfolioChart, type SelectedTrade } from '../components/PortfolioChart/PortfolioChart'
import { portfolioData } from '../data/generateData'
import { Box } from '../components/ui/Box'
import styles from './workbench.module.css'

const LoadingScreen = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 1400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <Box position="absolute" inset={0} background="var(--bg)"
      display="flex" flexDirection="column" alignItems="center" justifyContent="center"
      gap={20} zIndex={100}
    >
      <Box display="flex" alignItems="flex-end" gap={3} height={28}>
        {[0.45, 0.75, 1, 0.6, 0.85].map((h, i) => (
          <div
            key={i}
            className={styles.bar}
            style={{
              height: `${h * 28}px`,
              opacity: 0.4 + h * 0.6,
              animation: `workbench-pulse 1.1s ease-in-out ${i * 0.12}s infinite alternate`,
            }}
          />
        ))}
      </Box>

      <span className={styles.loadingText}>Loading portfolio data…</span>

      <style>{`
        @keyframes workbench-pulse {
          from { transform: scaleY(0.5); opacity: 0.3; }
          to   { transform: scaleY(1);   opacity: 1; }
        }
      `}</style>
    </Box>
  )
}

export const WorkbenchPage = () => {
  const [ready, setReady] = useState(false)

  // Mobile chart↔table state
  const [mobileSelected, setMobileSelected] = useState<SelectedTrade | null>(null)
  const [mobileDateRange, setMobileDateRange] = useState<[Date, Date] | null>(null)
  const [mobilePeriodDays, setMobilePeriodDays] = useState(90)

  const mobileFilteredIds = useMemo<Set<number> | null>(() => {
    if (!mobileDateRange) return null
    const [start, end] = mobileDateRange
    const startStr = start.toISOString().slice(0, 10)
    const endStr   = end.toISOString().slice(0, 10)
    const ids = new Set<number>()
    for (const pos of portfolioData) {
      for (const trade of pos.trades) {
        if (trade.date >= startStr && trade.date <= endStr) {
          ids.add(pos.id)
          break
        }
      }
    }
    return ids
  }, [mobileDateRange])

  return (
    <>
      <Box className="mobile-only" flex={1} flexDirection="column" minHeight={0}>
        <Box height={220} flexShrink={0}>
          <PortfolioChart
            onBrush={setMobileDateRange}
            hasBrush={mobileDateRange !== null}
            selectedTrade={mobileSelected}
            periodDays={mobilePeriodDays}
            onPeriodChange={setMobilePeriodDays}
            highlightedTicker={null}
            expandedPositionTrades={null}
          />
        </Box>
        <MobilePositionList
          selectedTrade={mobileSelected}
          onTradeSelect={setMobileSelected}
          filteredIds={mobileFilteredIds}
        />
      </Box>

      <Box className="hide-mobile" flex={1} display="flex" flexDirection="column" minHeight={0} position="relative">
        {!ready && <LoadingScreen onDone={() => setReady(true)} />}
        <Box
          flex={1} display="flex" flexDirection="column" minHeight={0}
          opacity={ready ? 1 : 0} transition="opacity 0.4s ease"
        >
          <ChartTableView />
        </Box>
      </Box>
    </>
  )
}
