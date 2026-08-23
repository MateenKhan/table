import React from 'react'

/**
 * `true` while a CSS media query matches, re-rendering when it flips.
 *
 * ── Why a media query and not a measuring pass ──────────────────────────────
 * The toolbar needs to know "is this a phone-width viewport" to decide what to
 * collapse (ActionsRow). The obvious alternative — measure the row, see what
 * fits, move the remainder into a menu — is the oscillation bug documented in
 * OverflowGroups: the measured content and the measured container are the same
 * quantity in a loop (content shrinks → an auto-sized container shrinks → more
 * room is reported → content grows → repeat). A media query cannot loop,
 * because what it reads — the VIEWPORT — is not affected by anything we render
 * in response to it. The answer changes only when the user resizes the window.
 *
 * SSR: `matchMedia` does not exist on the server, and neither does `window`.
 * `useSyncExternalStore`'s third argument is the server snapshot, so a server
 * render (and the first client render that has to match it) gets `false` — the
 * wide layout, which is the one where nothing is hidden. It corrects itself on
 * the first client-side subscription. This matters because these components
 * ship as a library (src/lib.tsx) into hosts we do not control.
 *
 * Safari < 14 has `MediaQueryList` but only the deprecated
 * `addListener`/`removeListener`, hence the fallback.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mql = window.matchMedia(query)
      if (mql.addEventListener) {
        mql.addEventListener('change', onStoreChange)
        return () => mql.removeEventListener('change', onStoreChange)
      }
      mql.addListener(onStoreChange)
      return () => mql.removeListener(onStoreChange)
    },
    [query],
  )
  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia(query).matches
  }, [query])
  const getServerSnapshot = React.useCallback(() => false, [])
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function useSkipper() {
  const shouldSkipRef = React.useRef<boolean | null>(true)
  const shouldSkip = shouldSkipRef.current

  // Wrap a function with this to skip a pagination reset temporarily
  const skip = React.useCallback(() => {
    shouldSkipRef.current = false
  }, [])

  React.useEffect(() => {
    shouldSkipRef.current = true
  })

  const result = React.useMemo(
    () => [Boolean(shouldSkip), skip] as const,
    [shouldSkip, skip],
  )

  return result
}
