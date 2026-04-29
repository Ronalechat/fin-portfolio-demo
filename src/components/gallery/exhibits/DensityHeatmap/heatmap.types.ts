export interface TradePoint {
  t: number      // normalised time in [0, 1]
  price: number
}

export interface BinCell {
  colIdx: number
  rowIdx: number
  count: number
  normalised: number
  tMin: number
  tMax: number
  priceMin: number
  priceMax: number
}

export interface TooltipState {
  containerX: number
  containerY: number
  cell: BinCell
}

export interface GaussianCluster {
  mean: number
  std: number
  weight: number  // fraction of totalPoints assigned to this cluster; must sum to 1.0
}

export interface ExampleConfig {
  id: string
  label: string
  seed: number
  totalPoints: number
  cols: number
  rows: number
  clusters: GaussianCluster[]
  intro: string
  description: string
  colorScale?: string  // d3 interpolator key; defaults to 'viridis'
  height?: number      // chart height in px; defaults to 480
}
