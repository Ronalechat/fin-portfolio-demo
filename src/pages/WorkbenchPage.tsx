import { useState, useEffect } from 'react'
import { ChartTableView } from '../components/ChartTableView'

function LoadingScreen({ onDone }: { onDone: () => void }) {
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
      {/* Animated bar chart icon */}
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

export function WorkbenchPage() {
  const [ready, setReady] = useState(false)

  return (
    <>
      {/* Mobile notice — shown below 768px */}
      <div
        className="mobile-only"
        style={{
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
          textAlign: 'center',
          gap: 16,
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="20" height="14" rx="2" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="8" y1="21" x2="16" y2="21" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="18" x2="12" y2="21" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Best viewed on desktop
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 280,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}>
          The Workbench combines a D3 chart and a virtualised table across a wide layout.
          Open on a laptop for the full experience.
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hide-mobile" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
        {!ready && <LoadingScreen onDone={() => setReady(true)} />}
        {/* Mount eagerly so data is ready when loading screen fades */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, opacity: ready ? 1 : 0, transition: 'opacity 0.4s ease' }}>
          <ChartTableView />
        </div>
      </div>
    </>
  )
}
