import React from 'react'
import type { VisibilityState } from '@tanstack/react-table'
import type { ColumnFormats } from './format'

export type StoredView = { visibility?: VisibilityState; formats?: ColumnFormats }

export function readView(key: string | undefined): StoredView {
  if (!key) return {}
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === 'object' ? (parsed as StoredView) : {}
  } catch {
    return {}
  }
}

export function useStoredView(key: string | undefined, view: StoredView) {
  const { visibility, formats } = view
  React.useEffect(() => {
    if (!key) return
    try {
      localStorage.setItem(key, JSON.stringify({ visibility, formats }))
    } catch {
      return
    }
  }, [key, visibility, formats])
}
