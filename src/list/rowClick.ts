import type React from 'react'

const INTERACTIVE =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="checkbox"], [role="menuitem"], [data-row-click-ignore]'

export const ROW_LINK_ATTR = 'data-row-link'

export function isOwnInteraction(event: React.SyntheticEvent): boolean {
  const target = event.target as Element | null
  const row = event.currentTarget as Element
  const hit = target?.closest?.(INTERACTIVE)
  return !!hit && row.contains(hit) && !hit.hasAttribute(ROW_LINK_ATTR)
}

export function wantsNewTab(event: React.MouseEvent): boolean {
  return event.button === 1 || event.metaKey || event.ctrlKey || event.shiftKey
}

export function hasTextSelection(): boolean {
  return typeof window !== 'undefined' && window.getSelection?.()?.type === 'Range'
}
