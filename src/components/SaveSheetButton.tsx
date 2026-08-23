import React from 'react'
import { AlertTriangle, Check, Save } from 'lucide-react'
import Tooltip from '../ui/Tooltip'
import type { SaveSheetResult } from '../explicitSheetSave'

// The always-visible Save: writes the table on screen — rows, column
// definitions and headers, formulas — into browser storage, so a reload brings
// it back. It sits immediately before Reload in the peek row, the two
// whole-sheet, non-destructive actions side by side.
//
// ── Why it owns a state machine instead of just calling the handler ────────
// A save is invisible. Nothing on the grid changes, no dialog opens, and the
// bytes go somewhere the user cannot see — so a button that only ran the write
// would leave "did that work?" unanswered on every press, and would leave a
// quota failure (the realistic failure here: localStorage is a few MB and a
// sheet full of data:-URL images can approach it) looking exactly like success.
// So the icon itself is the receipt: a tick for a moment on success, a warning
// that stays put on failure, with the tooltip and the accessible name saying
// the same thing in words. The tone follows the row's idiom — emerald while
// idle/saved, rose when the write was refused.
type Props = {
  /** Persists the current sheet. Must not throw; reports its own outcome. */
  onSave: () => SaveSheetResult
}

/** How long the tick lingers before the button returns to its resting state. */
const SAVED_MS = 1800
/** Failure lingers longer — it is a message, not an acknowledgement. */
const ERROR_MS = 5000

export default function SaveSheetButton({ onSave }: Props) {
  const [status, setStatus] = React.useState<'idle' | SaveSheetResult>('idle')
  const timerRef = React.useRef<number | undefined>(undefined)

  // A press while the previous receipt is still showing restarts the timer, and
  // an unmount mid-receipt must not leave a setState pointing at a dead
  // component.
  React.useEffect(
    () => () => {
      if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    },
    [],
  )

  const handleClick = () => {
    let result: SaveSheetResult
    try {
      result = onSave()
    } catch {
      // Belt and braces: `saveSheetNow` is written not to throw, but an onClick
      // is the one place where a surprise would take the whole app down.
      result = 'error'
    }
    setStatus(result)
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(
      () => setStatus('idle'),
      result === 'saved' ? SAVED_MS : ERROR_MS,
    )
  }

  const label =
    status === 'saved'
      ? 'Saved to this browser'
      : status === 'error'
        ? "Couldn't save — this browser's storage is full or unavailable"
        : 'Save this sheet to this browser'

  const Icon =
    status === 'saved' ? Check : status === 'error' ? AlertTriangle : Save

  return (
    <>
      <Tooltip label={label}>
        <button
          type="button"
          className={
            status === 'error'
              ? 'icon-btn-sm border border-rose-200 text-rose-600 sm:hover:bg-rose-50'
              : 'icon-btn-sm border border-emerald-200 text-emerald-600 sm:hover:bg-emerald-50'
          }
          onClick={handleClick}
          aria-label={label}
        >
          <Icon size={14} aria-hidden="true" />
        </button>
      </Tooltip>
      {/* The icon swap is the sighted user's confirmation; this is the same
          receipt for a screen reader, which would otherwise hear nothing at all
          (the button keeps focus, so a renamed aria-label is not re-announced
          on its own in every reader). */}
      <span className="sr-only" role="status" aria-live="polite">
        {status === 'saved'
          ? 'Sheet saved'
          : status === 'error'
            ? 'Sheet could not be saved'
            : ''}
      </span>
    </>
  )
}
