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
      {/* Desktop layout */}
      <div
        className="gallery-desktop"
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0, // critical: allows flex children to scroll independently
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        <div className="gallery-shell" style={{ display: 'flex', flex: 1, minWidth: 1040, minHeight: 0 }}>
          <GallerySidebar active={activeExhibit} onSelect={setActiveExhibit} />

          <div
            className="gallery-content"
            style={{
              flex: 1,
              minWidth: 0,
              overflowY: 'auto',
              padding: '32px 40px',
            }}
          >
            {renderExhibit(activeExhibit)}
          </div>
        </div>
      </div>
    </>
  )
}
