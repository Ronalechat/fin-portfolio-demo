import type { Position, Trade } from './types'

const TICKERS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL',
  'META', 'AMZN', 'JPM', 'V', 'NFLX',
]

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

function generateTrades(
  posId: number,
  count: number,
  rng: () => number,
): Trade[] {
  return Array.from({ length: count }, (_, j) => ({
    tradeId: `T-${posId}-${j}`,
    date: randomDateInLastYear(rng),
    quantity: randInt(rng, 5, 200),
    price: toFixed2(randRange(rng, 50, 500)),
    side: j % 2 === 0 ? 'BUY' : 'SELL',
  }))
}

export const portfolioData: Position[] = Array.from(
  { length: 500 },
  (_, i) => {
    const rng = seededRand(i * 7919 + 1)
    const ticker = TICKERS[i % TICKERS.length]
    const quantity = randInt(rng, 10, 1000)
    const avgCost = toFixed2(randRange(rng, 50, 500))
    const currentPrice = toFixed2(randRange(rng, 50, 500))
    const pnlDollar = toFixed2((currentPrice - avgCost) * quantity)
    const pnlPercent = toFixed2(
      ((currentPrice - avgCost) / avgCost) * 100,
    )
    const tradeCount = randInt(rng, 2, 6)
    const trades = generateTrades(i, tradeCount, rng)

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
