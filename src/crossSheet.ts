// ─────────────────────────────────────────────────────────────────────────────
// crossSheet.ts — the thing `@sheet1(a1)` actually reads.
//
// The formula engine takes a `CrossSheetContext`: given an `@name` as typed,
// hand back that sheet's id, a cell reader over its rows, and its formula map.
// This module is the one implementation of that for the app, and the reason it
// is not four lines is that a sheet the user is not looking at IS NOT IN MEMORY.
//
// ── Three tiers, most authoritative first ───────────────────────────────────
//
//   1. LIVE      the active sheet's rows, straight out of App's React state.
//                Must win: the user is typing into them, and localStorage is
//                up to 400ms behind (the autosave is debounced).
//   2. STASH     `App.sheetStashRef` — sheets visited earlier THIS session,
//                held verbatim so a switch-and-back is lossless. Fresher than
//                storage for the same reason: the stash is written on the way
//                out of a tab, storage is written on a timer.
//   3. STORAGE   `loadCustomSheet(id)`, a synchronous `JSON.parse` of another
//                tab's entire payload.
//
// Tier 3 is why the cache exists, and it is not a micro-optimisation. `getCell`
// is called once per reference per formula cell per recalc PASS (up to 8), and
// a recalc runs on every keystroke in an edited cell. Without memoisation
// `=@sheet1(a1)+@sheet1(b1)` on 200 rows would parse another sheet's JSON
// thousands of times per character typed. With it, once per invalidation.
//
// ── Invalidation, which is the part that has to be right ────────────────────
//
// A cache that hands back a sheet's rows from before an edit shows a number
// that is quietly wrong, and nothing on screen says so. So the rule here is
// deliberately blunt rather than clever:
//
//   · `publishActive(id, rows, formulas)` — App calls this whenever the active
//     sheet's rows or formulas change. It replaces the LIVE tier outright (no
//     cache involved) and, if the ACTIVE ID itself changed, drops the entire
//     cache. A tab switch is the only moment an inactive sheet's bytes can
//     have moved underneath us — that is when the outgoing sheet was flushed
//     to the stash and to storage — so clearing everything there is both
//     sufficient and cheap (it happens on a click, not on a keystroke).
//   · `invalidate(id)` — for the surgical cases: a sheet deleted, or the whole
//     workbook reset.
//
// The version counter is bumped on every one of those and is exposed as a
// `useSyncExternalStore` snapshot, so App's recalc effect can list it as a
// dependency and re-run when a sheet this one reads has moved.
//
// ── Live or deferred? ───────────────────────────────────────────────────────
//
// Cross-sheet values recompute when the referencing sheet recalculates, which
// is: on every edit to that sheet (its own `data`/`formulas` change), and on
// arriving at it (a switch replaces both). Values are NOT pushed to inactive
// sheets when their source changes — an inactive sheet has no rendered cells to
// be wrong, and its rows are recomputed the moment it comes back on screen,
// before anything is painted.
//
// The one thing this does not do is recompute the ACTIVE sheet when an
// INACTIVE one changes. That cannot happen through the UI: only the active
// sheet is editable, so the only writer of an inactive sheet's bytes is the tab
// switch that made it inactive — which already invalidates. A second browser
// tab editing the same workbook's localStorage would defeat this; that is a
// pre-existing property of every store in this package (formatting, column
// types and merges all cache the same way), not something `@` introduces.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { sheetNameKey } from './formula'
import type { CrossSheetContext, CrossSheetSheet, FormulaMap } from './formula'
import { loadCustomSheet } from './sheetPersistence'
import type { SheetInfo } from './sheetRegistry'

/** The two pieces of a sheet a formula on another sheet can see. */
type SheetData = {
  rows: readonly unknown[]
  formulas: FormulaMap
}

const EMPTY: SheetData = { rows: [], formulas: {} }

/** What App hands over for tier 2. Returns null when the sheet was never
 *  visited this session. */
export type StashProvider = (sheetId: string) => SheetData | null

class CrossSheetStore {
  private listeners = new Set<() => void>()
  private revision = 0

  /** Normalised name → sheet id. Rebuilt whenever the tab strip is set. */
  private byName = new Map<string, string>()

  private activeId = ''
  private active: SheetData = EMPTY

  private stash: StashProvider | null = null

  /** Tier-2/3 results, keyed by sheet id. Never holds the active sheet. */
  private cache = new Map<string, SheetData>()

  /** Bumped on every change — a `useSyncExternalStore` snapshot. */
  get version(): number {
    return this.revision
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.revision++
    this.listeners.forEach((listener) => {
      // A misbehaving subscriber must never take a recalc down with it.
      try {
        listener()
      } catch {
        /* ignored */
      }
    })
  }

  /**
   * The tabs that exist, in order. Names come from here, so a rename or a
   * delete reaches `@` resolution the instant the registry is committed —
   * which is what makes a deleted sheet's references turn into `#REF!` with no
   * extra plumbing.
   */
  setSheets(sheets: readonly SheetInfo[]): void {
    const next = new Map<string, string>()
    for (const sheet of sheets) {
      const key = sheetNameKey(sheet.name)
      // First tab wins a collision (two tabs folding to the same key, e.g.
      // `Sales` and `sales`). Deterministic beats "whichever was last" — the
      // formula resolves to the same sheet on every render.
      if (key && !next.has(key)) next.set(key, sheet.id)
    }
    // Only notify on a real change. App re-publishes the strip on every
    // registry commit — including ones that only moved `activeId` — and a
    // version bump there would re-run every recalc effect that watches this
    // for nothing.
    let same = next.size === this.byName.size
    if (same) {
      for (const [key, id] of next) {
        if (this.byName.get(key) !== id) {
          same = false
          break
        }
      }
    }
    this.byName = next
    if (!same) this.notify()
  }

  /** Tier 2's source. Set once, at mount. */
  setStashProvider(provider: StashProvider | null): void {
    this.stash = provider
  }

  /**
   * The active sheet's live rows and formulas. Called from App on every change
   * to either. Clears the cache only when the ACTIVE SHEET ITSELF changed —
   * see the invalidation note at the top of this file for why that is the only
   * moment another sheet's bytes can have moved.
   */
  publishActive(sheetId: string, rows: readonly unknown[], formulas: FormulaMap): void {
    const switched = sheetId !== this.activeId
    if (
      !switched &&
      this.active.rows === rows &&
      this.active.formulas === formulas
    ) {
      return
    }
    this.activeId = sheetId
    this.active = { rows, formulas }
    // Only a SWITCH notifies. Publishing the active sheet's own new rows must
    // not: the sole consumer that would care is that sheet's recalc, which is
    // already re-running (its `data`/`formulas` are what changed), and waking
    // it a second time would cost an extra render on every keystroke — and,
    // because the recalc writes `data`, would be a step away from a loop.
    if (switched) {
      this.cache.clear()
      this.notify()
    }
  }

  /** Forget one sheet's cached bytes (deleted, or erased by a workbook reset). */
  invalidate(sheetId?: string): void {
    if (sheetId === undefined) this.cache.clear()
    else if (!this.cache.delete(sheetId)) return
    this.notify()
  }

  /**
   * `@name` → sheet id, or null. Case-insensitive; whitespace INSIDE a name is
   * significant (`Q1 Sales` and `Q1Sales` are two different tabs), and only
   * the outer padding is trimmed. `sheetNameKey` is the single definition of
   * that, shared with `sheetRegistry.uniqueSheetName` so the names uniqueness
   * allows are exactly the ones this can tell apart.
   */
  resolveName = (name: string): string | null =>
    this.byName.get(sheetNameKey(name)) ?? null

  /** The sheet on screen — what the grid's highlight has to be measured
   *  against. `''` when the host has no sheets at all. */
  get activeSheetId(): string {
    return this.activeId
  }

  private dataFor(sheetId: string): SheetData {
    if (sheetId === this.activeId) return this.active

    const cached = this.cache.get(sheetId)
    if (cached) return cached

    const stashed = this.stash?.(sheetId)
    const loaded =
      stashed ??
      (() => {
        const saved = loadCustomSheet(sheetId)
        return saved
          ? { rows: saved.data, formulas: saved.formulas as FormulaMap }
          : EMPTY
      })()

    // A sheet with no stored bytes is cached as EMPTY too: it will still be
    // empty on the next of the eight recalc passes, and re-deciding that costs
    // a `localStorage.getItem` each time.
    this.cache.set(sheetId, loaded)
    return loaded
  }

  /**
   * The engine's view of one sheet, by typed name. Everything a formula needs
   * in one object so a cycle can never be traced through a sheet whose rows
   * could not be read (see `CrossSheetSheet`).
   */
  lookup = (name: string): CrossSheetSheet | null => {
    const id = this.resolveName(name)
    if (!id) return null
    const data = this.dataFor(id)
    return {
      id,
      formulas: data.formulas,
      getCell: (rowIndex: number, columnId: string) =>
        (data.rows[rowIndex] as Record<string, unknown> | undefined)?.[columnId],
    }
  }

  /** The context to hand `recalcFormulas` for the sheet currently on screen. */
  contextFor(sheetId: string): CrossSheetContext {
    return { sheetId, lookup: this.lookup }
  }

  /**
   * Column ids of a sheet, for the editor's live token highlighting — it needs
   * to know whether `a1` inside `@other(a1)` names a real column over THERE.
   * Empty when the sheet has no saved column defs to read them from.
   */
  columnIdsFor(name: string): string[] | null {
    const id = this.resolveName(name)
    if (!id) return null
    const data = this.dataFor(id)
    // Derived from a row rather than from the column defs: the rows are what
    // `getCell` reads, so this answers the question actually being asked
    // ("would a reference to this column find anything?") and needs no second
    // storage tier of its own.
    const first = data.rows[0] as Record<string, unknown> | undefined
    return first ? Object.keys(first) : []
  }
}

/** The single store App feeds and the engine reads. */
export const crossSheet = new CrossSheetStore()

/** Re-render / re-run an effect when any sheet a formula could read has moved. */
export function useCrossSheetVersion(): number {
  return React.useSyncExternalStore(
    React.useCallback((listener: () => void) => crossSheet.subscribe(listener), []),
    () => crossSheet.version,
    () => crossSheet.version,
  )
}
