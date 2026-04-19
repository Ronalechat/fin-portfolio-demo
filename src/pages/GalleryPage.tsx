import { useState, lazy, Suspense } from 'react'
import { GallerySidebar } from '../components/gallery/GallerySidebar'
import { LttbLineChart } from '../components/gallery/exhibits/LttbLineChart'
import { OhlcCandlestick } from '../components/gallery/exhibits/OhlcCandlestick'
import { DensityHeatmap } from '../components/gallery/exhibits/DensityHeatmap'

// Exhibits 4-6 are lazy-loaded: they will be heavier (force simulation, etc.)
// and there is no reason to bundle them into the initial chunk when the user
// may never visit them. React.lazy + Suspense gives us code-splitting for free
// with Vite's dynamic import chunking.
const ForceNetworkLazy = lazy(() =>
  import('../components/gallery/exhibits/ForceNetwork').then(m => ({ default: m.ForceNetwork }))
)
const CrossfilterScatterLazy = lazy(() =>
  import('../components/gallery/exhibits/CrossfilterScatter').then(m => ({ default: m.CrossfilterScatter }))
)
const ParallelCoordinatesLazy = lazy(() =>
  import('../components/gallery/exhibits/ParallelCoordinates').then(m => ({ default: m.ParallelCoordinates }))
)

const lazyFallback = (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <span style={{ color: 'var(--text-2)', fontSize: 12 }}>Loading…</span>
  </div>
)

function renderExhibit(n: number) {
  switch (n) {
    case 1:
      return <LttbLineChart />
    case 2:
      return <OhlcCandlestick />
    case 3:
      return <DensityHeatmap />
    case 4:
      return (
        <Suspense fallback={lazyFallback}>
          <ForceNetworkLazy />
        </Suspense>
      )
    case 5:
      return (
        <Suspense fallback={lazyFallback}>
          <CrossfilterScatterLazy />
        </Suspense>
      )
    case 6:
      return (
        <Suspense fallback={lazyFallback}>
          <ParallelCoordinatesLazy />
        </Suspense>
      )
    default:
      return null
  }
}

export function GalleryPage() {
  const [activeExhibit, setActiveExhibit] = useState(1)

  return (
    <>
      {/* Mobile notice — hidden on desktop via CSS */}
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
          <rect x="5" y="2" width="14" height="20" rx="2" stroke="var(--accent)" strokeWidth="1.5" />
          <line x1="9" y1="18" x2="15" y2="18" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Best viewed on desktop
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 280,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        }}>
          The Graph Gallery contains canvas-based interactive charts that require a wide screen.
          Try opening this page on a laptop or tablet in landscape mode.
        </div>
      </div>

      {/* Desktop layout — hidden on mobile via CSS */}
      <div
        className="hide-mobile"
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0, // critical: allows flex children to scroll independently
        }}
      >
        <GallerySidebar active={activeExhibit} onSelect={setActiveExhibit} />

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px 40px',
          }}
        >
          {renderExhibit(activeExhibit)}
        </div>
      </div>
    </>
  )
}
