import React from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import Tooltip from '../ui/Tooltip'
import { useConfirm } from '../ui'
import { sheetNameKey } from '../formula'
import type { SheetInfo } from '../sheetRegistry'

// The tab strip: one tab per sheet, a "+" to add one, rename in place, delete
// behind a confirm. It is the only place in the app that says "there is more
// than one sheet", and everything below it — the toolbar, the grid, the four
// persistence stores — keeps working on exactly one sheet at a time.
//
// ── Why it is 32px and not a band ───────────────────────────────────────────
// The toolbar below this has been squeezed hard: the ops rail gave up its
// reserved height, the search row and the action row share a line at lg+, and
// every control is on the 32px `icon-btn-sm` grid. A tab strip is chrome that is
// on screen 100% of the time while being interacted with perhaps twice a
// session, so it gets the smallest height that still holds a 14px glyph and a
// readable label: ONE 32px row, the same module as every button beside it, plus
// the toolbar's own 6px (`gap-1.5`) below. Tabs are `h-8` for the same reason —
// a taller tab would make the strip taller than the "+" that sits in it.
//
// ── Overflow ────────────────────────────────────────────────────────────────
// The tab list scrolls horizontally on its own; "+" sits OUTSIDE the scroller so
// it never scrolls away from a user with a dozen sheets. `scrollbar-none` is not
// used — a hidden scrollbar on a strip that can overflow is how content becomes
// unreachable on a trackpad-less machine — the strip is simply short enough that
// the browser's overlay scrollbar is unobtrusive.

// ── Rename validation ───────────────────────────────────────────────────────
//
// There are exactly TWO rules on a sheet name: non-empty, and unique. Nothing
// else — spaces, hyphens, brackets, leading digits, unicode, apostrophes all
// belong to the user. The grammar used to impose a third (a name had to be a
// formula identifier) and this box used to enforce it by filtering keystrokes;
// `@name(expr)` now reads everything up to the first `(`, with a quoted `@'…'`
// form for the rest, so there is nothing left to filter.
//
// What is left is worth SAYING rather than silently repairing. Committing
// `Data` next to an existing `Data` used to produce `Data2` — a name the user
// did not choose, appearing without explanation. Now the box says why it will
// not take it, and refuses until it is fixed.
//
// `uniqueSheetName` still auto-suffixes on the programmatic paths (loading a
// hand-edited registry, minting a new tab) because there is nobody there to
// ask. This is the one path with a person in it.
const validateName = (
  raw: string,
  sheets: readonly SheetInfo[],
  selfId: string,
): string | null => {
  const name = raw.trim()
  if (!name) return "Sheet name can't be empty"
  const key = sheetNameKey(name)
  // The same key `@` resolves on, so what this refuses is exactly what a
  // formula could not have told apart.
  const clash = sheets.find((s) => s.id !== selfId && sheetNameKey(s.name) === key)
  return clash ? `A sheet called "${clash.name}" already exists` : null
}

/**
 * The message under an invalid rename box.
 *
 * Portalled and `position: fixed` for the same reason `Tooltip` is: the tab
 * scroller is `overflow-x: auto`, which computes the y axis to `auto` as well,
 * so an absolutely-positioned bubble inside it would be clipped by the 32px
 * strip it is trying to escape.
 *
 * It is NOT the shared `Tooltip`. That component is vendored verbatim from the
 * shared UI and must not diverge, and it is a hover/focus HINT: one dark slate
 * bubble, shown on pointer-in. This has to be visible the whole time the value
 * is invalid, whether or not anything is hovered, and it has to carry the rose
 * danger tone the rest of the app uses. Reaching those through `Tooltip` would
 * mean adding a `tone` and an `open` prop to a file that is explicitly frozen.
 */
function InvalidMessage({
  anchorRef,
  message,
  id,
}: {
  anchorRef: React.RefObject<HTMLInputElement | null>
  message: string
  id: string
}) {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)

  React.useLayoutEffect(() => {
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect()
      if (!rect) return
      setPos({ x: Math.max(8, rect.left), y: rect.bottom + 6 })
    }
    place()
    // Capture-phase scroll: the tab strip is its own scroller, and it scrolls
    // the active tab into view — including the one being renamed.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, message])

  if (!pos || typeof document === 'undefined') return null
  return createPortal(
    <div
      id={id}
      role="tooltip"
      style={{ position: 'fixed', left: pos.x, top: pos.y, maxWidth: '16rem' }}
      className="pointer-events-none z-[200] flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-2xs font-semibold leading-snug text-rose-700 shadow-lg"
    >
      <AlertCircle size={14} aria-hidden="true" className="shrink-0" />
      <span>{message}</span>
    </div>,
    document.body,
  )
}

type Props = {
  /** Every sheet, in tab order. Never empty (see `withoutSheet`). */
  sheets: SheetInfo[]
  activeId: string
  /** Flush the current sheet and rehydrate from `id`. */
  onSelect: (id: string) => void
  /** Append a blank sheet and switch to it. */
  onAdd: () => void
  onRename: (id: string, name: string) => void
  /** Destroys the sheet's stored data. Only ever called after a confirm. */
  onDelete: (id: string) => void
  /** Whether the search + actions band below this strip is showing. */
  chromeOpen: boolean
  /** Toggle that band. Owned by App so the band itself can be left unrendered. */
  onToggleChrome: () => void
  className?: string
}

export default function SheetTabs({
  sheets,
  activeId,
  chromeOpen,
  onToggleChrome,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  className = '',
}: Props) {
  const confirm = useConfirm()
  // Which tab is being renamed in place, and the uncommitted text. Held as one
  // pair so a rename can never be "open on tab A showing tab B's draft".
  const [editing, setEditing] = React.useState<{ id: string; value: string } | null>(
    null,
  )
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Focus + select on open, so the rename is one gesture: double-click, type,
  // Enter. Keyed on the id alone — re-running on every keystroke would reselect
  // the text the user is in the middle of typing.
  React.useEffect(() => {
    if (!editing) return
    inputRef.current?.focus()
    inputRef.current?.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  // Live, on every keystroke, so the border and the message appear as the
  // problem does rather than at the end. `null` while the draft is fine.
  const nameError = editing ? validateName(editing.value, sheets, editing.id) : null

  // The refused-commit nudge. Held in state (not by touching `classList`, which
  // the next render would wipe) and cleared on a TIMER, not on `animationend`:
  // under `prefers-reduced-motion` the animation is `none` and that event never
  // fires, which would leave the class stuck on.
  const [shaking, setShaking] = React.useState(false)
  const shakeTimer = React.useRef<number | null>(null)
  const clearShake = React.useCallback(() => {
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current)
    shakeTimer.current = null
    setShaking(false)
  }, [])
  React.useEffect(() => clearShake, [clearShake])

  const refuseCommit = () => {
    clearShake()
    // A CSS animation only restarts once the class has actually left the
    // element, so a second refusal inside the 260ms window needs one render
    // without it. Pressing Enter twice on the same bad name must nudge twice.
    window.requestAnimationFrame(() => setShaking(true))
    shakeTimer.current = window.setTimeout(() => setShaking(false), 600)
  }

  const commitRename = () => {
    if (!editing) return
    // Refuse, do not repair. Renaming to `Data` beside an existing `Data` used
    // to commit `Data2`; that is the silent substitution this whole change
    // exists to stop. The box stays open, still holding what was typed.
    if (validateName(editing.value, sheets, editing.id)) {
      refuseCommit()
      inputRef.current?.focus()
      return
    }
    onRename(editing.id, editing.value)
    setEditing(null)
    clearShake()
  }

  const cancelRename = () => {
    setEditing(null)
    clearShake()
  }

  const askDelete = async (sheet: SheetInfo) => {
    const ok = await confirm({
      title: `Delete "${sheet.name}"`,
      message:
        'Delete this sheet and everything in it? The other sheets are untouched — only this tab and its contents go.',
      details: [
        'Its rows, columns and headers are deleted',
        'Its formulas, formatting, column types and column merges are deleted',
        'This cannot be undone, and Undo does not reach across sheets',
      ],
      confirmLabel: 'Delete sheet',
      tone: 'danger',
    })
    if (ok) onDelete(sheet.id)
  }

  // The last sheet cannot go: zero sheets is not a state the app can render, and
  // silently leaving a blank one behind would look like the delete failed. The
  // "×" is therefore absent (not disabled) on a lone tab — nothing to explain
  // when there is nothing to press. `withoutSheet` refuses the same case.
  const canDelete = sheets.length > 1

  // Keep the active tab on screen. Without this, adding a sheet once the strip
  // overflows leaves the new (active) tab scrolled off to the right, so the
  // click appears to have done nothing — and returning to a sheet whose tab has
  // scrolled away gives no sign of which one is current.
  const scrollerRef = React.useRef<HTMLDivElement>(null)
  const activeTabRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const scroller = scrollerRef.current
    const tab = activeTabRef.current
    if (!scroller || !tab) return
    // Only scroll when it is actually out of view: an unconditional
    // scrollIntoView would yank the strip on every render that touches it.
    const box = scroller.getBoundingClientRect()
    const at = tab.getBoundingClientRect()
    if (at.left < box.left) {
      scroller.scrollLeft -= box.left - at.left
    } else if (at.right > box.right) {
      scroller.scrollLeft += at.right - box.right
    }
  }, [activeId, sheets.length])

  return (
    // `data-keeps-selection` for the same reason ActionsRow carries it: this is
    // toolbar surface, and `useCellSelection`'s click-away deselect would
    // otherwise drop the user's selection the instant they reached for a tab.
    // Switching sheets does clear the selection anyway (it belongs to the sheet
    // being left), but RENAMING a tab must not, and neither must a mis-click on
    // the strip's own padding.
    <div
      data-keeps-selection=""
      role="tablist"
      aria-label="Sheets"
      // `items-start`, NOT `items-center`. Once the tabs overflow, the scroller
      // grows by its scrollbar (~8-10px) while "+" and the collapse chevron stay
      // 32px — centring then floats those two BELOW the tabs they sit beside,
      // which is the misalignment that shows up only after enough sheets exist
      // to make the scrollbar appear. Aligning tops instead pins all three to
      // the same edge, and is identical to centring in the common case where
      // there is no scrollbar and every child is the same 32px.
      className={`flex shrink-0 items-start gap-1 ${className}`.trim()}
    >
      {/* No `flex-1`: the scroller sizes to its tabs so "+" sits immediately
          after the last one (where the eye looks for it) rather than being
          pushed to the far right of an empty strip. `min-w-0` still lets it
          shrink and scroll once the tabs outgrow the row. */}
      <div
        ref={scrollerRef}
        // `custom-scrollbar` is not decoration here: a default horizontal
        // scrollbar is ~10-15px tall and lands INSIDE this 32px row, so the
        // whole strip would grow the moment tabs overflow — in a toolbar the
        // user has repeatedly asked to make shorter. The shared thin skin keeps
        // the row's height independent of how many sheets exist.
        className="custom-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto"
      >
        {sheets.map((sheet) => {
          const active = sheet.id === activeId
          const isEditing = editing?.id === sheet.id

          if (isEditing) {
            const errorId = `jt-sheet-rename-error-${sheet.id}`
            return (
              <React.Fragment key={sheet.id}>
                <input
                  ref={inputRef}
                  value={editing.value}
                  // NOT filtered. Every character the user types survives —
                  // spaces, hyphens, brackets, unicode, the lot. The two rules
                  // that remain are checked, shown and enforced instead of
                  // being applied behind the user's back.
                  onChange={(e) => {
                    setEditing({ id: sheet.id, value: e.target.value })
                    // A refusal is about the value that was refused; typing is
                    // the fix, so the nudge stops the moment they do.
                    clearShake()
                  }}
                  // `onBlur` CANCELS an invalid draft rather than refusing it.
                  // Refusing would mean pulling focus back into a box the user
                  // is trying to leave — a trap — and Escape already means
                  // "leave this alone", so clicking away means the same thing.
                  onBlur={() => {
                    if (nameError) cancelRename()
                    else commitRename()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      // Escape gets out of an INVALID state as cleanly as a
                      // valid one: the tab keeps the name it had.
                      cancelRename()
                    }
                    // The grid binds a lot of single keys; while a tab name is
                    // being typed none of them are meant for it.
                    e.stopPropagation()
                  }}
                  aria-label={`Rename ${sheet.name}`}
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? errorId : undefined}
                  className={`h-8 w-28 shrink-0 rounded-lg border bg-white px-2 text-xs font-semibold text-slate-900 outline-none ${
                    nameError
                      ? 'border-rose-400 ring-1 ring-rose-200'
                      : 'border-sky-400'
                  } ${shaking ? 'jt-shake' : ''}`}
                />
                {nameError ? (
                  <InvalidMessage
                    anchorRef={inputRef}
                    message={nameError}
                    id={errorId}
                  />
                ) : null}
              </React.Fragment>
            )
          }

          return (
            <div
              key={sheet.id}
              ref={active ? activeTabRef : undefined}
              className={`group flex h-8 shrink-0 items-center rounded-lg border pl-2.5 transition-colors ${
                active
                  ? 'border-sky-300 bg-sky-50 text-sky-700'
                  : 'border-slate-200 bg-white text-slate-600 sm:hover:bg-slate-50'
              } ${canDelete ? 'pr-1' : 'pr-2.5'}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                // Double-click is the rename gesture users already expect from a
                // spreadsheet tab, and it is also how this grid renames a COLUMN
                // header — same gesture, same meaning, one thing to learn.
                onClick={() => {
                  if (!active) onSelect(sheet.id)
                }}
                onDoubleClick={() => setEditing({ id: sheet.id, value: sheet.name })}
                className="max-w-[10rem] truncate text-xs font-semibold outline-none"
              >
                {sheet.name}
              </button>
              {canDelete ? (
                <Tooltip label={`Delete "${sheet.name}"`}>
                  <button
                    type="button"
                    aria-label={`Delete ${sheet.name}`}
                    onClick={() => void askDelete(sheet)}
                    // Rose only on hover, unlike the toolbar's Delete-all: that
                    // one is a single always-visible control whose danger has to
                    // read at rest, whereas a rose "×" repeated on every tab
                    // would turn the whole strip into a warning stripe. The
                    // confirm is what actually fences this.
                    className="ml-0.5 inline-grid h-6 w-6 shrink-0 place-items-center rounded-md text-slate-400 transition-colors sm:hover:bg-rose-50 sm:hover:text-rose-600"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </Tooltip>
              ) : null}
            </div>
          )
        })}
      </div>

      <Tooltip label="New sheet">
        <button
          type="button"
          aria-label="New sheet"
          onClick={onAdd}
          className="icon-btn-sm shrink-0 border border-slate-300 text-slate-600 sm:hover:bg-slate-100"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </Tooltip>

      {/* Collapse the whole chrome — search box, every action, the contextual
          ops rail — so the grid gets the rest of the window.
          ── Why this toggle is legitimate where the old one was not ───────────
          ActionsRow used to carry a chevron that swapped one set of buttons for
          another: it never gave the grid a single pixel, and it hid actions to
          show actions. That is why it was deleted (see the note at the top of
          ActionsRow). This one does the opposite — it trades the entire band for
          table rows, which is the only thing a toggle up here can honestly buy.
          It lives on the SHEETS row, and the sheets row is the one thing it does
          NOT collapse: something has to stay on screen to bring the rest back,
          and the tabs are what the user is likeliest to still want while reading
          a lot of rows. `ml-auto` pins it to the far right, away from "+", so
          the destructive-to-your-layout control is not adjacent to the one you
          press repeatedly. */}
      <Tooltip label={chromeOpen ? 'Hide search & actions' : 'Show search & actions'}>
        <button
          type="button"
          aria-label={chromeOpen ? 'Hide search and actions' : 'Show search and actions'}
          aria-expanded={chromeOpen}
          onClick={onToggleChrome}
          className="icon-btn-sm ml-auto shrink-0 border border-slate-300 text-slate-600 sm:hover:bg-slate-100"
        >
          {chromeOpen ? (
            <ChevronUp size={14} aria-hidden="true" />
          ) : (
            <ChevronDown size={14} aria-hidden="true" />
          )}
        </button>
      </Tooltip>
    </div>
  )
}
