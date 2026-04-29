import type { ComponentPropsWithoutRef, CSSProperties } from 'react'

type LayoutProps = {
  display?: CSSProperties['display']
  position?: CSSProperties['position']
  flex?: CSSProperties['flex']
  flexDirection?: CSSProperties['flexDirection']
  flexWrap?: CSSProperties['flexWrap']
  flexShrink?: CSSProperties['flexShrink']
  flexGrow?: CSSProperties['flexGrow']
  alignItems?: CSSProperties['alignItems']
  justifyContent?: CSSProperties['justifyContent']
  gap?: CSSProperties['gap']
  width?: CSSProperties['width']
  height?: CSSProperties['height']
  minWidth?: CSSProperties['minWidth']
  minHeight?: CSSProperties['minHeight']
  maxWidth?: CSSProperties['maxWidth']
  maxHeight?: CSSProperties['maxHeight']
  overflow?: CSSProperties['overflow']
  overflowX?: CSSProperties['overflowX']
  overflowY?: CSSProperties['overflowY']
  padding?: CSSProperties['padding']
  margin?: CSSProperties['margin']
  opacity?: CSSProperties['opacity']
  transition?: CSSProperties['transition']
  background?: CSSProperties['background']
  inset?: CSSProperties['inset']
  top?: CSSProperties['top']
  left?: CSSProperties['left']
  right?: CSSProperties['right']
  bottom?: CSSProperties['bottom']
  zIndex?: CSSProperties['zIndex']
}

export type BoxProps = LayoutProps & Omit<ComponentPropsWithoutRef<'div'>, keyof LayoutProps>

export const Box = ({
  display, position, flex, flexDirection, flexWrap, flexShrink, flexGrow,
  alignItems, justifyContent, gap, width, height, minWidth, minHeight,
  maxWidth, maxHeight, overflow, overflowX, overflowY, padding, margin,
  opacity, transition, background, inset, top, left, right, bottom, zIndex,
  style,
  ...divProps
}: BoxProps) => (
  <div
    style={{
      display, position, flex, flexDirection, flexWrap, flexShrink, flexGrow,
      alignItems, justifyContent, gap, width, height, minWidth, minHeight,
      maxWidth, maxHeight, overflow, overflowX, overflowY, padding, margin,
      opacity, transition, background, inset, top, left, right, bottom, zIndex,
      ...style,
    }}
    {...divProps}
  />
)
