export interface Trade {
  tradeId: string
  date: string
  quantity: number
  price: number
  side: 'BUY' | 'SELL'
}

export interface Position {
  id: number
  ticker: string
  quantity: number
  avgCost: number
  currentPrice: number
  pnlDollar: number
  pnlPercent: number
  trades: Trade[]
}
