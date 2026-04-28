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
    id: 'spike-cluster',
    label: 'Spike Cluster',
    seed: 13,
    totalPoints: 200_000,
    cols: 60,
    rows: 40,
    clusters: [
      { mean: 180, std: 4,  weight: 0.90 },
      { mean: 180, std: 35, weight: 0.10 },
    ],
    intro: 'One dominant tight cluster (90%) with a wide diffuse halo (10%) at 200k points.',
    description: '200,000 events: 90% within σ=4 of $180, 10% forming a wide halo. The Viridis scale compresses toward the spike peak — the halo appears near-invisible, showing how extreme density contrast affects colour perception.',
  },
]

export const DEFAULT_EXAMPLE_ID = 'dense-clusters'
