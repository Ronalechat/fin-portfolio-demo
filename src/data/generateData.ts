import type { Position, Trade } from './types'

// ─── Ticker universe (30 securities, diverse sectors) ──────────────────────
// Intentionally NOT just mega-caps. Includes fiber optics, pharma/biotech,
// resources, mid-cap tech — a realistic concentrated fund universe.

const TICKERS = [
  // Tech – large cap
  'AAPL', 'MSFT', 'NVDA',
  // Tech – mid cap
  'CRWD', 'SNOW', 'ARM',
  // Fiber optics / optical networking
  'LITE', 'COHR', 'VIAV', 'FYBR',
  // Pharma – large cap
  'PFE', 'MRK', 'ABBV',
  // Biotech / precision medicine
  'RXRX', 'EXAS', 'ACAD', 'AGEN',
  // Mining / Resources
  'BHP', 'RIO', 'FCX', 'WPM', 'NEM',
  // Energy
  'XOM', 'CVX', 'SLB',
  // Finance
  'JPM', 'GS',
  // Consumer
  'COST', 'TGT',
]

// Sector labels — used by gallery exhibits for colour coding
export const TICKER_SECTORS: Record<string, string> = {
  AAPL: 'Tech', MSFT: 'Tech', NVDA: 'Tech',
  CRWD: 'Tech', SNOW: 'Tech', ARM: 'Tech',
  LITE: 'Fiber Optics', COHR: 'Fiber Optics', VIAV: 'Fiber Optics', FYBR: 'Fiber Optics',
  PFE: 'Pharma', MRK: 'Pharma', ABBV: 'Pharma',
  RXRX: 'Biotech', EXAS: 'Biotech', ACAD: 'Biotech', AGEN: 'Biotech',
  BHP: 'Resources', RIO: 'Resources', FCX: 'Resources', WPM: 'Resources', NEM: 'Resources',
  XOM: 'Energy', CVX: 'Energy', SLB: 'Energy',
  JPM: 'Finance', GS: 'Finance',
  COST: 'Consumer', TGT: 'Consumer',
}

// ─── Seeded PRNG ────────────────────────────────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1))
}

function toFixed2(n: number): number {
  return Math.round(n * 100) / 100
}

function randomDateInLastYear(rng: () => number): string {
  const now = Date.now()
  const yearMs = 365 * 24 * 60 * 60 * 1000
  const ts = now - rng() * yearMs
  return new Date(ts).toISOString().slice(0, 10)
}

// ─── Price ranges per sector ─────────────────────────────────────────────────
// Gives each sector a realistic price band so the table feels authentic.

const SECTOR_PRICE_RANGE: Record<string, [number, number]> = {
  'Tech':          [80, 900],
  'Fiber Optics':  [10, 120],
  'Pharma':        [30, 320],
  'Biotech':       [5, 80],
  'Resources':     [15, 180],
  'Energy':        [40, 200],
  'Finance':       [60, 500],
  'Consumer':      [50, 900],
}

function priceRangeForTicker(ticker: string): [number, number] {
  const sector = TICKER_SECTORS[ticker] ?? 'Tech'
  return SECTOR_PRICE_RANGE[sector] ?? [20, 500]
}

// ─── Trade generation ────────────────────────────────────────────────────────

function generateTrades(
  posId: number,
  count: number,
  rng: () => number,
  avgCost: number,
): Trade[] {
  return Array.from({ length: count }, (_, j) => ({
    tradeId: `T-${posId}-${j}`,
    date: randomDateInLastYear(rng),
    quantity: randInt(rng, 5, 200),
    // Trades cluster around the avgCost ± 15% so history looks coherent
    price: toFixed2(avgCost * (0.85 + rng() * 0.30)),
    side: rng() > 0.45 ? 'BUY' : 'SELL',
  }))
}

// ─── Portfolio generation ────────────────────────────────────────────────────
// 500 positions across 30 tickers by default — large enough to make the
// virtualiser clearly useful, small enough for smooth demo load. Override with
// VITE_POSITION_COUNT when testing heavier or lighter datasets locally.
// Ticker assignment uses weighted modulo so sector distribution is uneven
// (more positions in large-cap, fewer in biotech — reflects a real fund tilt).

const DEFAULT_POSITION_COUNT = 500
const envPositionCount = Number(import.meta.env.VITE_POSITION_COUNT)
const POSITION_COUNT =
  Number.isFinite(envPositionCount) && envPositionCount > 0
    ? Math.floor(envPositionCount)
    : DEFAULT_POSITION_COUNT

export const portfolioData: Position[] = Array.from(
  { length: POSITION_COUNT },
  (_, i) => {
    const rng = seededRand(i * 7919 + 1)

    // Weighted ticker selection: large-cap tickers get higher weight
    // by sampling from a longer repeating list (simulates AUM concentration)
    const tickerIdx = Math.floor(rng() * TICKERS.length)
    const ticker = TICKERS[tickerIdx]!

    const [priceMin, priceMax] = priceRangeForTicker(ticker)
    const quantity  = randInt(rng, 10, 2000)
    const avgCost   = toFixed2(randRange(rng, priceMin, priceMax))
    // Current price: random walk ±25% from avgCost
    const drift     = 0.75 + rng() * 0.50
    const currentPrice = toFixed2(Math.max(1, avgCost * drift))
    const pnlDollar = toFixed2((currentPrice - avgCost) * quantity)
    const pnlPercent = toFixed2(((currentPrice - avgCost) / avgCost) * 100)
    const tradeCount = randInt(rng, 2, 6)
    const trades    = generateTrades(i, tradeCount, rng, avgCost)

    return {
      id: i,
      ticker,
      quantity,
      avgCost,
      currentPrice,
      pnlDollar,
      pnlPercent,
      trades,
    }
  },
)

// Computed once at module load — used by header AUM display and weight column.
export const TOTAL_PORTFOLIO_VALUE = portfolioData.reduce(
  (sum, p) => sum + p.currentPrice * p.quantity,
  0,
)
