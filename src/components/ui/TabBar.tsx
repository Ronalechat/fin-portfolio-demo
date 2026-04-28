import type { ReactNode } from 'react'
import styles from './TabBar.module.css'

export interface TabItem {
  id: string
  label: string
  /** Optional icon or badge rendered after the label. */
  adornment?: ReactNode
}

interface TabBarProps {
  items: TabItem[]
  activeId: string
  onSelect: (id: string) => void
  /** Additional class merged onto the tablist container. */
  className?: string
}

export const TabBar = ({ items, activeId, onSelect, className }: TabBarProps) => {
  const containerClass = className
    ? `${styles.tabBar} ${className}`
    : styles.tabBar

  return (
    <div role="tablist" className={containerClass}>
      {items.map(item => {
        const isActive = item.id === activeId
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(item.id)}
            className={isActive ? `${styles.tab} ${styles.tabActive}` : styles.tab}
          >
            {item.label}
            {item.adornment}
          </button>
        )
      })}
    </div>
  )
}
