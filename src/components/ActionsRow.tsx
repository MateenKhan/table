import React from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { useCellSelection, type SelectionScope } from '../useCellSelection'
import { useMediaQuery } from '../hooks'

// The actions div. ONE adaptive band: the search query on the left, and on the
// right a rail for the contextual selection ops (the "CELL / ROW / COLUMN"
// strip) followed by every general action, laid out in priority order.
//
// ── How much of the toolbar is on screen, and when ───────────────────────────
// There used to be a hard collapsed/expanded split at EVERY width: collapsed
// showed a "peek" of four icons and a chevron; expanded HID the peek and swapped
// in the captioned groups. Three things were wrong with that. The chevron was
// rendered even when there was nothing behind it worth opening; opening it took
// actions AWAY (the peek) to show others, so the row never showed all of what
// fitted; and Reload (peek) and Delete-all (the "Danger" group) — a pair of
// whole-sheet lifecycle actions the user thinks of together — could never be on
// screen at the same time.
//
// At md and up that split is gone for good and nothing replaces it. Every action
// that survives the selection filter is rendered, in priority order, into a
// `flex-wrap` row: what fits sits on the first line, the rest flows onto a
// second. Nothing is hidden, so there is nothing for a toggle to reveal and NO
// TOGGLE IS RENDERED. See the anti-oscillation note below for why "what fits" is
// left to the browser rather than decided by a measuring pass of our own.
//
// Below md, wrapping alone was not enough — "now there is no accordion when the
// space is less, like for mobile or tab". Two different things were starving the
// action line, and they need two different fixes.
//
// The first was the COLUMN SPLIT, and it was the whole of the tablet problem. It
// used to start at `sm`, so from 640px up the actions were handed half a row
// while the rail's floor stayed an absolute 208px. At 768px that is 368 - 208 =
// 160px, about three buttons, three stacked lines — the 640-767 band was no
// better than a phone, and 768-1023 was no better than that. Two columns simply
// do not fit below `lg`, so below `lg` there is one: the query takes a line and
// the actions take the next at full width. A 768px tablet now lays all ~9
// actions (~400px of buttons and groups) on ONE line with room to spare, so it
// needs no collapse at all — the fix was to stop starving the row, not to start
// hiding things in it.
//
// The second is real and cannot be laid out away: a 375px phone has ~343px no
// matter what the split does, and ~9 icon buttons plus two captioned groups do
// not fit in it. That is what the "⋮" below md is for.
//
// So: phones collapse, tablets and up never do, and nothing at lg+ changed.
//
// Below md, then, the first NARROW_INLINE_COUNT actions of ACTION_PRIORITY stay
// inline and the remainder collapse behind one "⋮" button. That control is
// deliberately not the old chevron:
//   • it exists only when `collapsed.length > 0` — never an empty menu, never a
//     control with nothing behind it (the old chevron's first sin);
//   • opening it ADDS the rest to the screen. It never removes an inline action
//     to make room for a collapsed one (the old chevron's second sin), so
//     Reload and Delete-all are both reachable, and both inline, at every width;
//   • ACTION_PRIORITY is the ONLY ordering. "What stays inline" is literally
//     `visible.slice(0, NARROW_INLINE_COUNT)` — there is no second list saying
//     which actions are phone-worthy, so reordering that one array retunes the
//     narrow toolbar as well as the wide one.
//
// ── Each action is rendered EXACTLY ONCE ─────────────────────────────────────
// `inline` and `collapsed` are disjoint slices of the same sorted array, and
// each node appears in exactly one of the two JSX subtrees. The tempting
// alternative — render everything twice and let `hidden` / `md:hidden` pick a
// winner — would double-MOUNT the stateful children (the live pagination inputs,
// the functions dropdown, the selection-aware Clear), which is the bug the same
// note at the top of OverflowGroups exists to prevent. The split is therefore
// made in JS, from one boolean.
//
// ── Why this cannot oscillate ────────────────────────────────────────────────
// That boolean comes from `useMediaQuery`, i.e. from the VIEWPORT width, which
// nothing we render can change. Contrast OverflowGroups, which measures its own
// container: there, content and container are the same quantity in a loop
// (content shrinks → the auto-sized container shrinks → more room is reported →
// content grows → repeat). There is no measuring pass anywhere in this file, no
// ResizeObserver and no layout read — the only input is "is the window narrower
// than md", and the only thing that changes it is the user resizing the window.
//
// ── Why the ops rail is a fixed share with a floor, not `w-auto` ─────────────
// The ops strip MEASURES its own container to decide what to fold into its "⋮"
// (see OverflowGroups). If the rail's width were a function of the strip's
// content — as `sm:w-auto sm:max-w-[50%]` made it — that is a feedback loop of
// exactly the kind described above. The rail is therefore `flex-1 basis-0`
// inside a definite `lg:w-1/2` column, so its width is (half the row) minus the
// widths of the action buttons beside it, and those widths do not depend on
// anything the strip does.
//
// `lg:min-w-[13rem]` is the floor that keeps that rail usable: without it a line
// full of buttons leaves the strip a few pixels and `overflow-hidden` clips its
// eyebrow, which is the "Delete row rendered hundreds of pixels off-screen" bug
// wearing a smaller hat. Within lg+ the floor is unconditional — it does NOT
// appear only when something is selected — because a floor that came and went
// with the selection would change where the buttons wrap, and that is a layout
// jump (see the reservation note on the rail itself). BELOW lg the floor is gone
// and the rail takes a whole line of its own instead. At those widths the floor
// was not protecting the strip from the buttons, it was starving them: 208px out
// of a 343px phone line, or of a 340px half-column on a tablet, left room for
// about three, which is what stacked the toolbar three and four deep. On its own
// full-width line the strip gets MORE width than the floor ever guaranteed it,
// and it still has its own "⋮" for whatever does not fit there. That line is
// only taken when something is selected — see the rail's own note for why no
// height is reserved for it at any width.

/** Below Tailwind's `md` — the complement of its `(min-width: 768px)`, written
 *  as 767.98px so a fractional viewport width (browser zoom, HiDPI) cannot land
 *  in a gap between the two and match neither.
 *  This is deliberately NOT the same breakpoint as the `lg:` variants on the
 *  layout below, and the two must not be "tidied" into one. They answer
 *  different questions: `lg` is where two columns stop fitting side by side, and
 *  `md` is where a single full-width line stops fitting all the actions. Between
 *  them — the 768-1023 tablet band — the layout is stacked AND everything is
 *  inline, which is the point. */
const NARROW_QUERY = '(max-width: 767.98px)'

/**
 * How many of ACTION_PRIORITY stay inline below md. Four 32px `icon-btn-sm`s,
 * their dividers, and the "⋮" come to roughly 180px, which clears the
 * narrowest line this layout produces — a 288px row on a 320px phone — without
 * wrapping. Below md the actions always have the FULL row width (the column
 * split starts at lg), so 210px is the only figure that matters here.
 * Four is also where ACTION_PRIORITY's own grouping falls: it is Clear plus the
 * whole-sheet lifecycle cluster (Save / Reload / Delete-all) when there is a
 * selection, and that cluster plus Find when there is not.
 */
const NARROW_INLINE_COUNT = 4

/** A shared empty slice, so the wide path's `collapsed` is referentially stable
 *  and the effects that watch it never re-run on an unrelated render. */
const EMPTY_ACTIONS: readonly ToolbarAction[] = []

/** Every action the toolbar can show. Adding one means adding it here AND to
 *  `ACTION_PRIORITY` below — an id missing from the priority table still
 *  renders (it is appended last) rather than silently vanishing. */
export type ToolbarActionId =
  | 'clear'
  | 'save'
  | 'reload'
  | 'delete-all'
  | 'find'
  | 'functions'
  | 'export-csv'
  | 'settings'
  | 'help'
  | 'pagination'
  | 'profiles'

/**
 * What a given action needs from the current selection to be worth showing.
 * Read against the grid's own `SelectionScope` (useCellSelection) — the same
 * description the ops strip and the right-click menu filter themselves with, so
 * there is one answer to "what is selected" in the app, not a parallel one here.
 *
 *  • `always`      — no selection dependency (Save, Settings, the pager …).
 *  • `selection`   — needs something, anything, selected (Clear contents).
 *  • `no-selection`— only meaningful while nothing is selected.
 *  • `rows`        — acts on whole rows, so a COLUMN selection must not show it.
 *  • `columns`     — acts on whole columns, so a ROW selection must not show it.
 *
 * `rows` / `columns` are the user's "if I select a column, don't show me row
 * actions" rule. The toolbar itself currently carries no shape-specific action —
 * every row/column op (insert, delete, resize, freeze) lives in the ops strip,
 * which filters itself from the same scope — but the rule is expressed here so a
 * shape-specific toolbar action cannot be added without declaring its shape.
 */
export type ToolbarActionScope =
  | 'always'
  | 'selection'
  | 'no-selection'
  | 'rows'
  | 'columns'

type ActionSpec = {
  id: ToolbarActionId
  scope: ToolbarActionScope
  /** Draw a hairline before this action, fencing it off from its neighbour. */
  dividerBefore?: boolean
}

/**
 * THE priority list. First entry gets the first slot on the first line; the last
 * entries are the ones that spill onto the next line when the row runs out of
 * width. Tune the toolbar by reordering this array — nothing else encodes the
 * order, and no JSX at the call site does.
 *
 * The ordering rationale:
 *  1. `clear` — the only selection-contextual button. When there IS a selection
 *     it is what the user is most likely to want, and it must never be the thing
 *     that got pushed onto line two.
 *  2. `save` / `reload` / `delete-all` — the whole-sheet lifecycle cluster:
 *     write it out, read it back fresh, throw it away. The user thinks of Reload
 *     and Delete as a pair, so they are kept adjacent and both above the
 *     everyday tools; splitting them across lines is the bug this ordering
 *     exists to prevent. `delete-all` is fenced by hairlines on both sides and
 *     keeps its rose `icon-btn-danger` tone so neighbouring two benign buttons
 *     never makes it read as one.
 *  3. The everyday tools — find & replace, custom functions, settings, help.
 *  4. The captioned groups last. They are several times wider than an icon
 *     button, so they are the cheapest things to push onto a second line, and
 *     both are already conditional (the pager only past page one, profiles only
 *     on a vertical) so most of the time they are not there at all.
 */
const ACTION_PRIORITY: readonly ActionSpec[] = [
  { id: 'clear', scope: 'selection' },
  { id: 'save', scope: 'always' },
  { id: 'export-csv', scope: 'always' },
  { id: 'reload', scope: 'always' },
  { id: 'delete-all', scope: 'always', dividerBefore: true },
  { id: 'find', scope: 'always', dividerBefore: true },
  { id: 'functions', scope: 'always' },
  { id: 'settings', scope: 'always' },
  { id: 'help', scope: 'always' },
  { id: 'pagination', scope: 'always' },
  { id: 'profiles', scope: 'always' },
]

const PRIORITY_INDEX = new Map<ToolbarActionId, number>(
  ACTION_PRIORITY.map((spec, index) => [spec.id, index]),
)
const SPEC_BY_ID = new Map<ToolbarActionId, ActionSpec>(
  ACTION_PRIORITY.map((spec) => [spec.id, spec]),
)

/** One entry in the toolbar. `node` may be null/false for an action that is not
 *  applicable at all right now (no second page ⇒ no pager) — those are dropped
 *  before ordering, exactly as a `{cond && <X/>}` child used to be. */
export type ToolbarAction = {
  id: ToolbarActionId
  node: React.ReactNode
}

function scopeAllows(scope: ToolbarActionScope, kind: SelectionScope['kind']) {
  switch (scope) {
    case 'always':
      return true
    case 'selection':
      return kind !== 'none'
    case 'no-selection':
      return kind === 'none'
    // 'all' is a select-everything, which is every row AND every column, so it
    // satisfies both shapes.
    case 'rows':
      return kind === 'rows' || kind === 'all'
    case 'columns':
      return kind === 'columns' || kind === 'all'
  }
}

type Props = {
  // The query input — always visible, no label.
  query: React.ReactNode
  // The contextual selection ops (portaled strip slot). Collapses to nothing
  // when the selection is empty (its own empty:hidden).
  ops?: React.ReactNode
  // Every general action, in any order — this component sorts them by
  // ACTION_PRIORITY and filters them by the current selection. Order at the call
  // site is irrelevant on purpose: the priority lives in one place.
  actions: ToolbarAction[]
  className?: string
}

/** One action plus its leading hairline, rendered identically inline and inside
 *  the "⋮" panel. `index` is the position WITHIN THE LIST BEING RENDERED, so a
 *  divider is never the first thing on a row or the first thing in the panel —
 *  a fence with nothing on one side of it is just a stray line.
 *  `orientation` only picks which way the hairline runs; the action node itself
 *  is passed through untouched, and is passed to exactly one of the two lists. */
function ActionItem({
  action,
  index,
  orientation,
}: {
  action: ToolbarAction
  index: number
  orientation: 'row' | 'column'
}) {
  const spec = SPEC_BY_ID.get(action.id)
  const divider = spec?.dividerBefore && index > 0
  return (
    <>
      {divider ? (
        <span
          aria-hidden="true"
          className={
            orientation === 'row'
              ? 'mx-0.5 h-6 w-px shrink-0 self-center bg-slate-200'
              : 'my-0.5 h-px w-full shrink-0 bg-slate-200'
          }
        />
      ) : null}
      <div className="shrink-0">{action.node}</div>
    </>
  )
}

export default function ActionsRow({
  query,
  ops,
  actions,
  className = '',
}: Props) {
  // The grid's own description of what is selected. `useCellSelection` returns
  // null outside a provider (a bare ActionsRow in a story, say), which reads as
  // "nothing selected" — the same thing an empty grid reports.
  const selection = useCellSelection()
  const kind = selection?.selectionScope.kind ?? 'none'
  // Phone/small-tablet portrait. The ONLY input to the inline/collapsed split —
  // see the "why this cannot oscillate" note at the top. `false` (everything
  // inline) is also the SSR / no-matchMedia answer, so a host that renders this
  // on a server never ships a toolbar with actions hidden behind a control its
  // markup cannot open.
  const narrow = useMediaQuery(NARROW_QUERY)

  const visible = React.useMemo(() => {
    return actions
      .filter((action) => {
        // `false` / null / undefined are how a call site says "not applicable".
        if (action.node === null || action.node === undefined) return false
        if (action.node === false) return false
        const spec = SPEC_BY_ID.get(action.id)
        // Unknown id ⇒ no declared scope ⇒ always shown. Better a stray button
        // than an action that disappears because someone forgot the table.
        return spec ? scopeAllows(spec.scope, kind) : true
      })
      .map((action, index) => ({
        action,
        // Unlisted ids sort after everything listed, keeping their call-site
        // order among themselves.
        rank: PRIORITY_INDEX.get(action.id) ?? ACTION_PRIORITY.length + index,
      }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ action }) => action)
  }, [actions, kind])

  // The split. Two disjoint slices of ONE sorted array — every action lands in
  // exactly one of them, and each is rendered exactly once (see the header
  // note). At md+ `collapsed` is empty by construction: no menu, no toggle, and
  // `inline` is `visible`, which is the wide layout unchanged.
  const inline = narrow ? visible.slice(0, NARROW_INLINE_COUNT) : visible
  const collapsed = narrow ? visible.slice(NARROW_INLINE_COUNT) : EMPTY_ACTIONS

  const [menuOpen, setMenuOpen] = React.useState(false)
  const moreRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = React.useState<{
    left: number
    top: number
  } | null>(null)

  // Nothing left to collapse (the window widened past md, or the selection
  // change dropped an action) ⇒ the menu must not be left open over an empty
  // panel, and the toggle that opened it is already gone.
  React.useEffect(() => {
    if (!collapsed.length && menuOpen) setMenuOpen(false)
  }, [collapsed.length, menuOpen])

  // Anchor the panel under the "⋮" and keep it there through scrolls/resizes.
  // Portaled to <body> so no ancestor's `overflow-hidden` — the ops rail's, the
  // table region's — can clip it, the same reason OverflowGroups portals its own.
  React.useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null)
      return
    }
    const place = () => {
      const anchor = moreRef.current?.getBoundingClientRect()
      if (!anchor) return
      const width = menuRef.current?.offsetWidth ?? 240
      // Right-aligned to the button, then clamped into the viewport — on a
      // phone the button is near the right edge and the panel is most of the
      // screen wide, so the unclamped left is usually negative.
      const left = Math.max(
        8,
        Math.min(anchor.right - width, window.innerWidth - width - 8),
      )
      setMenuPos({ left, top: anchor.bottom + 6 })
    }
    place()
    const onReflow = () => place()
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [menuOpen, collapsed.length])

  React.useEffect(() => {
    if (!menuOpen) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (moreRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      // Collapsed actions portal their OWN popovers out to <body> — the
      // functions dropdown, the profiles listbox, the rows-per-page select.
      // Those are logically inside this panel even though they are not DOM
      // descendants of it, so a click in one must not dismiss it. Without this
      // the panel closed on the first click into any of them and every
      // subsequent adjustment meant reopening it (the bug OverflowGroups
      // documents at the same guard).
      const el =
        target instanceof Element ? target : (target as ChildNode).parentElement
      if (el?.closest('[data-popover-portal]')) return
      setMenuOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  return (
    // `data-keeps-selection` exempts the whole toolbar from the click-away
    // deselect in useCellSelection: the ops strip, the Clear eraser and the
    // format controls all act ON the selection, so clearing it as the pointer
    // goes down would take away what the click was for. Portaled panels the
    // toolbar owns are covered separately, by `data-popover-portal`.
    <div
      data-keeps-selection=""
      className={`flex flex-col gap-1.5 ${className}`.trim()}
    >
      <div className="flex flex-wrap items-center gap-1.5 lg:flex-nowrap">
        {/* Search — full width below lg (the actions take their own line under
            it); at lg+ it takes exactly half the row. Half is a FIXED share, not
            a content-derived one: see the oscillation note at the top.
            The split used to start at `sm`. That was the tablet bug: from 640px
            up the actions were handed half a row while the rail's floor stayed
            an absolute 208px, so at 768px the buttons got 368 − 208 = 160px and
            stacked three deep. Below lg there is simply not enough width for two
            columns, so there is one. */}
        <div className="min-w-0 grow basis-full lg:basis-1/2">{query}</div>
        {/* The action column. `flex-wrap` is the whole adaptive mechanism at
            md+: the browser fills the first line with as many actions as fit,
            in the priority order above, and flows the remainder onto the next
            line. `justify-end` keeps every line pinned to the right edge.
            Below md the wrapping still applies but has almost nothing to do,
            because only NARROW_INLINE_COUNT actions plus the "⋮" are here.
            ── Why the alignment flips at md ────────────────────────────────
            At md+ the actions share a line with the ops rail, sitting at the
            far right of the row: `justify-end` is what keeps them pinned there
            as the rail grows and shrinks beside them.
            Below md they have a line of their own, directly under the ops
            strip's line — and that strip's root is `flex w-full` (see
            CellContextStrip), so it fills its rail and starts hard against the
            left edge no matter what the rail's own justification says. Ending
            the buttons at the right while the strip begins at the left put the
            two lines on opposite edges with a gap between them. Both start at
            the left instead, which is also where the search box above and the
            grid below begin, so the whole narrow column shares one edge. */}
        <div className="flex w-full min-w-0 flex-wrap items-center justify-start gap-x-0.5 gap-y-1.5 lg:w-1/2 lg:justify-end">
          {/* The ops rail.
              ── No height is reserved for it, at any width ────────────────────
              It used to reserve its full height (4.25rem, later 4rem) at lg+ so
              the grid could not move when a selection appeared. That bought a
              still grid at a price paid on EVERY screen that has no selection:
              the rail shares a line with the search box, the search box is
              36px, and the reservation made that line 64px — so ~14px of empty
              band sat above the search box and another ~14px below it, all the
              time. Nearly every second of use has no selection in it, so the
              cost was continuous and the benefit occasional.
              The rail is therefore `hidden` until there IS a selection, at every
              width now rather than only below lg. Selecting a cell grows this
              line and the grid's top edge moves down once; clearing it moves
              back. That shift is real — it is the thing the old reservation
              existed to prevent, and it is most visible when clicking a column
              header to sort. It is accepted deliberately: it happens only on a
              deliberate gesture, the grid is `flex-1 min-h-0` so it absorbs the
              change by shrinking rather than pushing anything off-screen, and it
              trades an occasional movement for a permanent hole.
              If the movement ever proves worse than the hole, the fix is NOT to
              put the reservation back — it is to make the strip itself no taller
              than the 36px line it sits on (its height comes from ControlGroup's
              caption-above-the-border, not from its buttons), at which point
              there is nothing to reserve and nothing to jump.
              ── Width ────────────────────────────────────────────────────────
              Below lg: `basis-full`, a line of its own, `min-w-0` so it may
              shrink — no 13rem floor competing with the buttons for the one
              full-width line they now share the column with.
              At lg+: the floor is back and the rail is `flex-1 basis-0` beside
              the buttons, exactly as before.
              `overflow-hidden` is the backstop for a rail squeezed below its
              floor at very narrow widths — clipped inside the rail beats
              painting over the buttons next to it. */}
          <div
            className={`w-full min-w-0 basis-full items-center overflow-hidden lg:w-auto lg:min-w-[13rem] lg:flex-1 lg:basis-0 ${
              kind === 'none' ? 'hidden' : 'flex'
            }`}
          >
            {ops}
          </div>
          {inline.map((action, index) => (
            <ActionItem
              key={action.id}
              action={action}
              index={index}
              orientation="row"
            />
          ))}
          {/* The "⋮". Rendered ONLY when `collapsed` is non-empty, so it can
              never be a control with nothing behind it, and it never appears at
              md+ at all. */}
          {collapsed.length ? (
            <button
              ref={moreRef}
              type="button"
              className="icon-btn-sm shrink-0 border border-slate-300 text-slate-600 sm:hover:bg-slate-100"
              aria-label={`More actions (${collapsed.length})`}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              title="More actions"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
      {/* The panel. The collapsed actions live here and NOWHERE else — they are
          not also rendered inline under a `hidden`, which would double-mount the
          pagination inputs and the dropdowns. `flex-wrap` lets the icon buttons
          sit as a grid while the captioned groups (pager, profiles), several
          times wider, take a line each. */}
      {menuOpen && collapsed.length
        ? createPortal(
            <div
              ref={menuRef}
              // A labelled GROUP, not `role="menu"`: the contents are ordinary
              // buttons and captioned controls (the pager has a text input),
              // not `menuitem`s, and claiming a menu role would promise a
              // roving-tabindex keyboard model this panel does not implement.
              role="group"
              aria-label="More actions"
              data-popover-portal=""
              className="fixed z-[100] flex max-w-[90vw] flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg"
              style={{
                left: menuPos?.left ?? -9999,
                top: menuPos?.top ?? -9999,
                // Hidden for the one frame between mounting (needed to measure
                // the panel's own width) and being placed, so it never flashes
                // in the top-left corner.
                visibility: menuPos ? 'visible' : 'hidden',
              }}
            >
              {collapsed.map((action, index) => (
                <ActionItem
                  key={action.id}
                  action={action}
                  index={index}
                  orientation="column"
                />
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
