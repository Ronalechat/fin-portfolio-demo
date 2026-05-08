import { useState, lazy, Suspense } from 'react'
import { GallerySidebar } from '../components/gallery/GallerySidebar'
import { LttbLineChart } from '../components/gallery/exhibits/LttbLineChart'
import { OhlcCandlestick } from '../components/gallery/exhibits/OhlcCandlestick'
import { DensityHeatmap } from '../components/gallery/exhibits/DensityHeatmap'
import { Box } from '../components/ui/Box'

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
  <Box width="100%" height="100%" display="flex" alignItems="center" justifyContent="center">
    <span style={{ color: 'var(--text-2)', fontSize: 12 }}>Loading…</span>
  </Box>
)

const renderExhibit = (n: number) => {
  switch (n) {
    case 1: return <LttbLineChart />
    case 2: return <OhlcCandlestick />
    case 3: return <DensityHeatmap />
    case 4: return <Suspense fallback={lazyFallback}><ForceNetworkLazy /></Suspense>
    case 5: return <Suspense fallback={lazyFallback}><CrossfilterScatterLazy /></Suspense>
    case 6: return <Suspense fallback={lazyFallback}><ParallelCoordinatesLazy /></Suspense>
    default: return null
  }
}

export const GalleryPage = () => {
  const [activeExhibit, setActiveExhibit] = useState(1)

  return (
    <>
      <Box
        className="gallery-desktop"
        display="flex"
        flex={1}
        minHeight={0}
        overflowX="auto"
        overflowY="hidden"
      >
        <Box className="gallery-shell" display="flex" flex={1} minWidth={1040} minHeight={0}>
          <GallerySidebar active={activeExhibit} onSelect={setActiveExhibit} />

          <Box
            className="gallery-content"
            flex={1}
            minWidth={0}
            overflowY="auto"
            padding="32px 40px"
          >
            {renderExhibit(activeExhibit)}
          </Box>
        </Box>
      </Box>
    </>
  )
}
