import { useState } from 'react'
import { Text } from '../ui/Text'

interface Props {
  active: number
  onSelect: (n: number) => void
}

const EXHIBITS = [
  { n: 1, label: 'LTTB Line Chart' },
  { n: 2, label: 'OHLC Candlestick' },
  { n: 3, label: 'Density Heatmap' },
  { n: 4, label: 'Force Network' },
  { n: 5, label: 'Crossfilter Scatter' },
  { n: 6, label: 'Parallel Coordinates' },
] as const

export const GallerySidebar = ({ active, onSelect }: Props) => {
  const [hovered, setHovered] = useState<number | null>(null)

  return (
    <nav className="gallery-sidebar" style={{
      width: 180,
      flexShrink: 0,
      borderRight: '1px solid var(--border)',
      paddingTop: 24,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }}>
      {EXHIBITS.map(({ n, label }) => {
        const isActive = n === active
        const isHovered = n === hovered

        return (
          <button
            key={n}
            className="gallery-sidebar-item"
            onClick={() => onSelect(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(null)}
            style={{
              appearance: 'none',
              background: isHovered ? 'rgba(255,255,255,0.03)' : 'none',
              border: 'none',
              borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
              padding: '8px 20px',
              width: '100%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              textAlign: 'left',
              transition: 'background 0.1s',
            }}
          >
            <Text variant="monoSm" color={isActive ? 'var(--text-1)' : undefined}
              style={{ minWidth: 12, flexShrink: 0 }}>
              {n}
            </Text>
            <Text variant="caption" color="var(--text-1)" style={{ fontSize: 12, lineHeight: 1.3 }}>
              {label}
            </Text>
          </button>
        )
      })}
    </nav>
  )
}
