export type SortKey = 'date' | 'qty' | 'price' | 'value' | 'delta'
export interface SortState { key: SortKey; desc: boolean }

export interface SparklinePoint { x: number; y: number }

export interface SubTableCol {
  key: SortKey
  label: string
  align: 'left' | 'right'
  width: string
}
