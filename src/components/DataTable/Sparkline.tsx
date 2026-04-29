import { useMemo } from 'react'
import type { Trade } from '../../data/types'
import { buildSparklinePoints, polylinePath, areaPath } from './table.logic'
import styles from './table.module.css'

interface Props {
  trades: Trade[]
  pnlDollar: number
}

export const Sparkline = ({ trades, pnlDollar }: Props) => {
  const pts = useMemo(() => buildSparklinePoints(trades), [trades])

  if (pts.length < 2) return null

  const colour = pnlDollar >= 0 ? 'var(--positive)' : 'var(--negative)'

  return (
    <svg
      width={60}
      height={20}
      className={styles.sparklineSvg}
      aria-hidden="true"
    >
      <path d={areaPath(pts)} fill={colour} opacity={0.15} />
      <path d={polylinePath(pts)} fill="none" stroke={colour} strokeWidth={1} opacity={0.7} />
    </svg>
  )
}
