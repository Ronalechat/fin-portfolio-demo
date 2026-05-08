import type { ReactNode, CSSProperties } from 'react'

interface GalleryFrameProps {
  title: string
  description: string
  /** One-sentence context shown between the header divider and the chart. */
  intro?: string
  totalPoints: number
  renderedPoints: number
  algorithm?: string
  children: ReactNode
  height?: number
}

export function GalleryFrame({
  title,
  description,
  intro,
  totalPoints,
  renderedPoints,
  algorithm,
  children,
  height = 480,
}: GalleryFrameProps) {
  const isDownsampled = renderedPoints < totalPoints

  const chipText = isDownsampled
    ? `${renderedPoints.toLocaleString()} of ${totalPoints.toLocaleString()} pts · ${algorithm ?? ''}`
    : `${renderedPoints.toLocaleString()} of ${totalPoints.toLocaleString()} pts`

  const chipStyle: CSSProperties = {
    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: 11,
    color: isDownsampled ? 'var(--accent)' : 'var(--text-2)',
    letterSpacing: '-0.01em',
    whiteSpace: 'nowrap',
  }

  return (
    <div className="gallery-frame" style={{ width: '100%' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 10,
          marginBottom: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-1)',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </span>
        <span style={chipStyle}>{chipText}</span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 0 }} />

      {/* Intro — one sentence shown between divider and chart */}
      {intro && (
        <p
          style={{
            margin: 0,
            marginTop: 8,
            marginBottom: 0,
            fontSize: 11,
            color: 'var(--text-2)',
            maxWidth: 640,
            lineHeight: 1.5,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            letterSpacing: '-0.01em',
          }}
        >
          {intro}
        </p>
      )}

      {/* Chart area */}
      <div
        className="gallery-chart-area"
        style={{
          '--gallery-chart-height': `${height}px`,
          position: 'relative',
          marginTop: intro ? 8 : 0,
        } as CSSProperties}
      >
        {children}
      </div>

      {/* Description */}
      <p
        style={{
          margin: 0,
          marginTop: 12,
          fontSize: 11,
          color: 'var(--text-2)',
          maxWidth: 640,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
    </div>
  )
}
