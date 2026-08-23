import React from 'react'
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react'
import Tooltip from '../ui/Tooltip'
import { useConfirm } from '../ui'
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

  const commitRename = () => {
    if (!editing) return
    // An empty / whitespace name is not an error to shout about — the store
    // clamps it back to the existing name (`normalizeSheetName`), so committing
    // nothing simply leaves the tab as it was.
    onRename(editing.id, editing.value)
    setEditing(null)
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
            return (
              <input
                key={sheet.id}
                ref={inputRef}
                value={editing.value}
                onChange={(e) =>
                  setEditing({ id: sheet.id, value: e.target.value })
                }
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitRename()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditing(null)
                  }
                  // The grid binds a lot of single keys; while a tab name is
                  // being typed none of them are meant for it.
                  e.stopPropagation()
                }}
                aria-label={`Rename ${sheet.name}`}
                className="h-8 w-28 shrink-0 rounded-lg border border-sky-400 bg-white px-2 text-xs font-semibold text-slate-900 outline-none"
              />
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
