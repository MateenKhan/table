import React from 'react'
import { functionalUpdate, type Updater } from '@tanstack/react-table'

export function useControllable<T>(
  value: T | undefined,
  onChange: ((next: T) => void) | undefined,
  initial: T,
): [T, (updater: Updater<T>) => void] {
  const [inner, setInner] = React.useState(initial)
  const current = value === undefined ? inner : value
  const currentRef = React.useRef(current)
  currentRef.current = current
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  const controlled = value !== undefined

  const set = React.useCallback(
    (updater: Updater<T>) => {
      const next = functionalUpdate(updater, currentRef.current)
      if (Object.is(next, currentRef.current)) return
      currentRef.current = next
      if (!controlled) setInner(next)
      onChangeRef.current?.(next)
    },
    [controlled],
  )

  return [current, set]
}
