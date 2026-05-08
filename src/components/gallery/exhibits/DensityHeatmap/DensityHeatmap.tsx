import { useMemo, useState } from 'react'
import { GalleryFrame } from '../../GalleryFrame'
import { TabBar } from '../../../ui/TabBar'
import { EXAMPLES, DEFAULT_EXAMPLE_ID } from './heatmap.examples'
import { generateTradePoints, computePriceExtent, buildBins } from './heatmap.logic'
import { HeatmapChart } from './HeatmapChart'
import styles from './heatmap.module.css'

const TAB_ITEMS = EXAMPLES.map(e => ({ id: e.id, label: e.label }))

export const DensityHeatmap = () => {
  const [activeId, setActiveId] = useState<string>(DEFAULT_EXAMPLE_ID)

  // EXAMPLES is a module-level constant so .find() returns a stable reference
  // per activeId — useMemo deps use referential equality correctly.
  const config = EXAMPLES.find(e => e.id === activeId) ?? EXAMPLES[0]

  const rawPoints   = useMemo(() => generateTradePoints(config), [config])
  const priceExtent = useMemo(() => computePriceExtent(rawPoints), [rawPoints])
  const cells       = useMemo(
    () => buildBins(rawPoints, priceExtent, config.cols, config.rows),
    [rawPoints, priceExtent, config.cols, config.rows],
  )

  return (
    <GalleryFrame
      title="Density Heatmap"
      intro={config.intro}
      description={config.description}
      totalPoints={config.totalPoints}
      renderedPoints={config.totalPoints}
      height={config.height ?? 480}
    >
      <div className={styles.chartWrapper}>
        <TabBar items={TAB_ITEMS} activeId={activeId} onSelect={setActiveId} />
        <div className={styles.chartArea}>
          <HeatmapChart
            cells={cells}
            priceExtent={priceExtent}
            cols={config.cols}
            rows={config.rows}
            colorScale={config.colorScale}
            colorScaleFloor={config.colorScaleFloor}
          />
        </div>
      </div>
    </GalleryFrame>
  )
}
