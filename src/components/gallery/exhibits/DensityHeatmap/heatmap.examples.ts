import type { ExampleConfig } from './heatmap.types'

export const EXAMPLES: ExampleConfig[] = [
  {
    id: 'dense-clusters',
    label: 'Dense Clusters',
    seed: 99,
    totalPoints: 100_000,
    cols: 60,
    rows: 40,
    clusters: [
      { mean: 150, std: 15, weight: 0.40 },
      { mean: 200, std: 20, weight: 0.35 },
      { mean: 120, std: 10, weight: 0.25 },
    ],
    intro: 'Three asymmetric Gaussian clusters. Hover any cell to see exact count and bin range.',
    description: '100,000 synthetic trade events binned into a 60×40 grid. Three overlapping price clusters create a multi-modal distribution — legible via heatmap, opaque as a scatter plot. Viridis colour scale, d3.bin() on both axes.',
  },
  {
    id: 'bimodal-rails',
    label: 'Bimodal Rails',
    seed: 42,
    totalPoints: 50_000,
    cols: 60,
    rows: 40,
    clusters: [
      { mean: 130, std: 6, weight: 0.50 },
      { mean: 230, std: 6, weight: 0.50 },
    ],
    intro: 'Two tight symmetric price bands separated by a 100-point gap.',
    description: '50,000 events split evenly between two narrow price rails at $130 and $230. The empty gap between them is invisible in raw tick data but immediately visible as a density heatmap.',
  },
  {
    id: 'diffuse-cloud',
    label: 'Diffuse Cloud',
    seed: 7,
    totalPoints: 30_000,
    cols: 40,
    rows: 30,
    clusters: [
      { mean: 175, std: 65, weight: 1.0 },
    ],
    intro: 'A single very wide Gaussian — simulates near-uniform noise across the price range.',
    description: '30,000 events from a single wide distribution (σ=65). The coarser 40×30 grid prevents most cells from being empty. Demonstrates that perceived density depends on both point count and bin size.',
  },
  {
    id: 'rothko-bands',
    label: 'Rothko Bands',
    seed: 77,
    totalPoints: 100_000,
    cols: 55,
    rows: 20,
    chartBackground: '#EDE0C4',
    colorStops: [
      [0,     '#EDE0C4'],  // cream canvas — empty cells show background
      [0.018, '#EDE0C4'],  // hold cream through truly-empty cells
      [0.019, '#201D31'],  // abrupt jump to dark charcoal
      [0.09,  '#201D31'],  // flat dark plateau (dark-void cells land here)
      [0.10,  '#BB3D1C'],  // abrupt jump to warm orange-red
      [0.35,  '#C04520'],  // nearly flat warm (cells across warm band)
      [1.0,   '#C84820'],  // barely brighter at peak density
    ],
    height: 560,
    clusters: [
      { mean: 420, std: 30, weight: 0.05 },  // dark void — real density keeps cells in charcoal plateau
      { mean: 250, std: 14, weight: 0.30 },  // tight warm upper strip
      { mean: 100, std: 28, weight: 0.65 },  // dominant warm lower field
    ],
    intro: 'A vast dark void above two luminous colour fields — after Rothko\'s late paintings.',
    description: '100,000 events across three clusters on a cream canvas. A dark-void cluster at $420 fills the top 40% with flat charcoal. Two warm clusters — a tight strip at $250 and a dominant lower field at $100 — render as flat warm orange-red rectangles, each separated by a single row of bare canvas. A step-function palette (cream → charcoal → orange) eliminates gradients within each field.',
  },
]

export const DEFAULT_EXAMPLE_ID = 'dense-clusters'
