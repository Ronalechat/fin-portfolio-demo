import { useState, useEffect } from 'react'
import { ChartTableView } from '../components/ChartTableView'
import { MobilePositionList } from '../components/DataTable/MobilePositionList'

const LoadingScreen = ({ onDone }: { onDone: () => void }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 1400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 20,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 28 }}>
        {[0.45, 0.75, 1, 0.6, 0.85].map((h, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: `${h * 28}px`,
              background: 'var(--accent)',
              opacity: 0.4 + h * 0.6,
              borderRadius: 1,
              animation: `workbench-pulse 1.1s ease-in-out ${i * 0.12}s infinite alternate`,
            }}
          />
        ))}
      </div>

      <div style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 10,
        letterSpacing: '0.2em',
        textTransform: 'uppercase',
        color: 'var(--text-2)',
      }}>
        Loading portfolio data…
      </div>

      <style>{`
        @keyframes workbench-pulse {
          from { transform: scaleY(0.5); opacity: 0.3; }
          to   { transform: scaleY(1);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}

export const WorkbenchPage = () => {
  const [ready, setReady] = useState(false)

  return (
    <>
      {/* Mobile: simplified position list */}
      <div
        className="mobile-only"
        style={{ flex: 1, flexDirection: 'column' }}
      >
        <MobilePositionList />
      </div>

      {/* Desktop: full chart + table workbench */}
      <div
        className="hide-mobile"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}
      >
        {!ready && <LoadingScreen onDone={() => setReady(true)} />}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          opacity: ready ? 1 : 0,
          transition: 'opacity 0.4s ease',
        }}>
          <ChartTableView />
        </div>
      </div>
    </>
  )
}
