import React from 'react'

const LINE_HEIGHT = 16

const wheelPixels = (event: WheelEvent, delta: number, el: HTMLElement) =>
  event.deltaMode === 1 ? delta * LINE_HEIGHT : event.deltaMode === 2 ? delta * el.clientWidth : delta

export function scrollSideways(el: HTMLElement, event: WheelEvent): boolean {
  if (!event.shiftKey || event.deltaX !== 0 || event.deltaY === 0) return false
  const max = el.scrollWidth - el.clientWidth
  const from = el.scrollLeft
  const to = Math.min(max, Math.max(0, from + wheelPixels(event, event.deltaY, el)))
  if (to === from) return false
  el.scrollLeft = to
  event.preventDefault()
  return true
}

export function useHorizontalWheel(ref: React.RefObject<HTMLElement>, disabled?: boolean) {
  React.useEffect(() => {
    if (disabled) return
    const el = ref.current
    if (!el) return
    const onWheel = (event: WheelEvent) => scrollSideways(el, event)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, disabled])
}
