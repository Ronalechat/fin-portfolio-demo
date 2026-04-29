import type { ComponentPropsWithoutRef, CSSProperties, ElementType } from 'react'
import styles from './text.module.css'

export type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'labelSm' | 'caption' | 'mono' | 'monoSm' | 'intro'

type TextProps = {
  variant: TextVariant
  /** Override the rendered element. Defaults to span. */
  as?: ElementType
  /** Override the default color for this variant. Accepts any CSS color value. */
  color?: CSSProperties['color']
  /** Override font weight. */
  weight?: CSSProperties['fontWeight']
} & Omit<ComponentPropsWithoutRef<'span'>, 'color'>

export const Text = ({ variant, as: Tag = 'span', color, weight, className, style, ...rest }: TextProps) => (
  <Tag
    className={[styles[variant], className].filter(Boolean).join(' ')}
    style={{ ...(color !== undefined && { color }), ...(weight !== undefined && { fontWeight: weight }), ...style }}
    {...rest}
  />
)
