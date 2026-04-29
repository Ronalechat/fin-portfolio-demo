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
    seed: 21,
    totalPoints: 120_000,
    cols: 60,
    rows: 8,
    clusters: [
      { mean: 310, std: 20, weight: 0.22 },
      { mean: 200, std: 30, weight: 0.48 },
      { mean: 78,  std: 18, weight: 0.30 },
    ],
    intro: 'Three price bands rendered as thick horizontal slabs — the density contrast recalls Mark Rothko\'s colour field canvases.',
    description: '120,000 events across three Gaussian bands at $78, $200, and $310. The coarse 60×8 grid forces each cluster into a solid rectangular zone; the dominant centre band (48% of events) burns brightest while the upper and lower bands glow at lower intensity. Empty price ranges between the bands recede to near-black, reproducing the atmospheric weight Rothko achieved with layered paint.',
  },
]

export const DEFAULT_EXAMPLE_ID = 'dense-clusters'
