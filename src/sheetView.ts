// ─────────────────────────────────────────────────────────────────────────────
// sheetView.ts — the per-sheet LAYOUT, as opposed to the per-sheet data.
//
// `sheetPersistence.ts` saves what a sheet CONTAINS (rows, column defs, formula
// sources). This saves how the user arranged it: the order they dragged the
// columns into, the widths they pulled them to, what they hid, what they pinned,
// how tall they made a row, how they sorted and grouped, and their page size.
//
// It exists because of tabs. Before them, "the layout" was App state that lived
// as long as the page did, and losing it on reload was nobody's problem because
// a reload was a fresh start anyway. With tabs, switching away from a sheet and
// back is NOT a fresh start — the user expects the sheet they return to to be
// the sheet they left, widths and all — so the layout needs somewhere to live
// that survives the switch.
//
// ── What is deliberately NOT here ───────────────────────────────────────────
// Column filters, the global query and the row selection are transient view
// state, not layout. Restoring a forgotten filter from localStorage on a later
// visit is how a user concludes their data is gone, so those three are kept in
// App's in-session stash (lossless across a switch) and are simply not written
// to storage (so a reload clears them, exactly as it does today).
//
// Same defensive contract as every other store here: unreadable or malformed
// input degrades to "no saved layout", never to a throw.
// ─────────────────────────────────────────────────────────────────────────────

import { sheetScopedKey } from './sheetRegistry'

// A new key rather than a suffix on an existing one: nothing before tabs
// persisted layout, so there is no pre-tabs format to stay compatible with.
// Sheet 1 still gets the bare key, for consistency with the other four stores.
const KEY_BASE = 'tt.sheetView.v1'

const VIEW_VERSION = 1

/**
 * The JSON-safe layout of one sheet. Every field is optional: an absent field
 * means "this sheet never expressed an opinion", which is different from an
 * empty one and must stay distinguishable, or restoring a sheet would clobber
 * defaults it had never touched.
 */
export type PersistedSheetView = {
  version: typeof VIEW_VERSION
  columnOrder?: string[]
  columnSizing?: Record<string, number>
  columnVisibility?: Record<string, boolean>
  columnPinning?: { left?: string[]; right?: string[] }
  rowPinning?: { top?: string[]; bottom?: string[] }
  sorting?: { id: string; desc: boolean }[]
  grouping?: string[]
  pageSize?: number
  // Data-row index → px. Stored with string keys because that is what JSON
  // gives back; App reads them as numbers, which is why `toNumberMap` exists.
  rowHeights?: Record<string, number>
}

const viewKey = (sheetId: string) => sheetScopedKey(KEY_BASE, sheetId)

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Only string entries survive — a hand-edited array cannot inject objects. */
function stringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  return v.filter((x): x is string => typeof x === 'string')
}

function numberMap(v: unknown): Record<string, number> | undefined {
  if (!isObject(v)) return undefined
  const out: Record<string, number> = {}
  for (const [k, raw] of Object.entries(v)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[k] = raw
  }
  return out
}

function booleanMap(v: unknown): Record<string, boolean> | undefined {
  if (!isObject(v)) return undefined
  const out: Record<string, boolean> = {}
  for (const [k, raw] of Object.entries(v)) {
    if (typeof raw === 'boolean') out[k] = raw
  }
  return out
}

function sortingList(v: unknown): { id: string; desc: boolean }[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out: { id: string; desc: boolean }[] = []
  for (const entry of v) {
    if (!isObject(entry) || typeof entry.id !== 'string') continue
    out.push({ id: entry.id, desc: entry.desc === true })
  }
  return out
}

/** One sheet's saved layout, or `null` when there is none / it is unreadable. */
export function loadSheetView(sheetId: string): PersistedSheetView | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(viewKey(sheetId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed) || parsed.version !== VIEW_VERSION) return null

    const view: PersistedSheetView = { version: VIEW_VERSION }
    const columnOrder = stringArray(parsed.columnOrder)
    if (columnOrder) view.columnOrder = columnOrder
    const columnSizing = numberMap(parsed.columnSizing)
    if (columnSizing) view.columnSizing = columnSizing
    const columnVisibility = booleanMap(parsed.columnVisibility)
    if (columnVisibility) view.columnVisibility = columnVisibility
    if (isObject(parsed.columnPinning)) {
      view.columnPinning = {
        left: stringArray(parsed.columnPinning.left) ?? [],
        right: stringArray(parsed.columnPinning.right) ?? [],
      }
    }
    if (isObject(parsed.rowPinning)) {
      view.rowPinning = {
        top: stringArray(parsed.rowPinning.top) ?? [],
        bottom: stringArray(parsed.rowPinning.bottom) ?? [],
      }
    }
    const sorting = sortingList(parsed.sorting)
    if (sorting) view.sorting = sorting
    const grouping = stringArray(parsed.grouping)
    if (grouping) view.grouping = grouping
    if (typeof parsed.pageSize === 'number' && parsed.pageSize > 0) {
      view.pageSize = Math.trunc(parsed.pageSize)
    }
    const rowHeights = numberMap(parsed.rowHeights)
    if (rowHeights) view.rowHeights = rowHeights
    return view
  } catch {
    return null
  }
}

/** Write one sheet's layout. Quota / denial is swallowed, as everywhere else. */
export function saveSheetView(
  sheetId: string,
  view: Omit<PersistedSheetView, 'version'>,
): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(
      viewKey(sheetId),
      JSON.stringify({ version: VIEW_VERSION, ...view } satisfies PersistedSheetView),
    )
  } catch {
    /* the layout still holds for this session */
  }
}

/** Forget one sheet's layout outright (the tab was deleted). */
export function clearSheetView(sheetId: string): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.removeItem(viewKey(sheetId))
  } catch {
    /* ignore */
  }
}

/**
 * JSON gives object keys back as strings; `rowHeights` in App is keyed by the
 * NUMERIC data-row index. Convert on the way in so a restored height lands on
 * the row it was set on rather than on a key nothing looks up.
 */
export function toNumberMap(
  source: Record<string, number> | undefined,
): Record<number, number> {
  const out: Record<number, number> = {}
  if (!source) return out
  for (const [k, v] of Object.entries(source)) {
    const index = Number(k)
    if (Number.isInteger(index) && index >= 0) out[index] = v
  }
  return out
}
