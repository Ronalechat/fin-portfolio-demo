import type { ReactNode } from 'react'
import { Box } from '../ui/Box'
import { Text } from '../ui/Text'

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

export const GalleryFrame = ({
  title,
  description,
  intro,
  totalPoints,
  renderedPoints,
  algorithm,
  children,
  height = 480,
}: GalleryFrameProps) => {
  const isDownsampled = renderedPoints < totalPoints

  const chipText = isDownsampled
    ? `${renderedPoints.toLocaleString()} of ${totalPoints.toLocaleString()} pts · ${algorithm ?? ''}`
    : `${renderedPoints.toLocaleString()} of ${totalPoints.toLocaleString()} pts`

  return (
    <div style={{ width: '100%' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" style={{ paddingBottom: 10 }}>
        <Text variant="heading">{title}</Text>
        <Text variant="mono" color={isDownsampled ? 'var(--accent)' : 'var(--text-2)'}
          style={{ whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
          {chipText}
        </Text>
      </Box>

      <div style={{ height: 1, background: 'var(--border)' }} />

      {intro && (
        <Text variant="intro" as="p" style={{ margin: '8px 0 0', maxWidth: 640 }}>
          {intro}
        </Text>
      )}

      <Box
        height={height}
        position="relative"
        overflow="hidden"
        style={{ marginTop: intro ? 8 : 0 }}
      >
        {children}
      </Box>

      <Text variant="body" as="p" style={{ margin: '12px 0 0', maxWidth: 640 }}>
        {description}
      </Text>
    </div>
  )
}
