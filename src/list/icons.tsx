import type React from 'react'

const PATHS = {
  arrowUp: 'M12 19V5 M5 12l7-7 7 7',
  arrowDown: 'M12 5v14 M19 12l-7 7-7-7',
  sortable: 'M7 15l5 5 5-5 M7 9l5-5 5 5',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  chevronLeft: 'M15 18l-6-6 6-6',
  chevronsLeft: 'M11 17l-5-5 5-5 M18 17l-5-5 5-5',
  chevronsRight: 'M13 17l5-5-5-5 M6 17l5-5-5-5',
  columns: 'M3 3h18v18H3z M9 3v18 M15 3v18',
  pin: 'M12 17v5 M9 10.8V4h6v6.8l3 3.2v2H6v-2z',
  pinOff: 'M12 17v5 M9 10.8V4h6v6.8l3 3.2v2H6v-2z M2 2l20 20',
  download: 'M12 15V3 M7 10l5 5 5-5 M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4',
  filter: 'M3 6h18 M7 12h10 M10 18h4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
} as const

export type IconName = keyof typeof PATHS

type Props = { name: IconName; size?: number; className?: string; style?: React.CSSProperties }

export function Icon({ name, size = 14, className, style }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
