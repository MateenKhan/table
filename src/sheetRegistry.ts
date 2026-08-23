// ─────────────────────────────────────────────────────────────────────────────
// sheetRegistry.ts — WHICH sheets exist, and where each one's bytes live.
//
// Before tabs there was exactly one sheet, and every store that persists a
// piece of it wrote to a single fixed localStorage key:
//
//   tableFormatting          per-cell / row / column formatting   (formatting.ts)
//   tableColumnTypeOverrides per-column chosen datatype  (columnTypeOverrides.ts)
//   tableColumnMerges        column combine / group descriptors   (columnMerge.tsx)
//   tt.customSheet.v1        rows + column defs + formula sources (sheetPersistence.ts)
//
// Those four are MODULE SINGLETONS read from the render hot path
// (`resolveFormat` is a free function called once per painted cell), so making
// them instance-per-sheet would have meant threading an instance through
// context and touching every call site. Instead each one keeps its identity and
// gains a NAMESPACE: the key it reads and writes is chosen by whichever sheet is
// active, and switching sheets flushes the outgoing sheet's bytes and rehydrates
// the singleton from the incoming sheet's. The hot path never learns that tabs
// exist.
//
// ── The key scheme, and why sheet 1 has no suffix ───────────────────────────
// `sheetScopedKey(base, id)` is `base` for the FIRST sheet and `base:id` for
// every other one. The bare, un-suffixed keys above are the PRE-TABS FORMAT:
// they already hold the sheet of every user who had one before this feature
// existed. Aliasing sheet 1 onto them is the migration — it is instantaneous,
// cannot half-succeed, and cannot run out of quota partway through the way a
// copy-then-delete would. A user who opens the app after this change finds
// their sheet sitting in tab 1 exactly as they left it, with no import step.
//
// The corollary is that `FIRST_SHEET_ID` can never be handed out again. Ids come
// from `nextOrdinal`, a counter that only ever increases and is persisted with
// the registry, so a deleted sheet's id is never reused and a NEW sheet can
// never inherit a dead sheet's leftover bytes. That is the one property this
// whole file exists to guarantee: no sheet may ever read another sheet's data.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The id of the sheet that owns the pre-tabs, un-suffixed storage keys.
 * Reserved forever — `nextOrdinal` starts past it (see `EMPTY_REGISTRY`).
 */
export const FIRST_SHEET_ID = 's1'

/** One tab: a stable id and the name shown on it. */
export type SheetInfo = {
  id: string
  name: string
}

/** The ordered tab strip plus which tab is showing. */
export type SheetRegistry = {
  version: 1
  sheets: SheetInfo[]
  activeId: string
  /**
   * The number the NEXT sheet id is minted from. Persisted (rather than derived
   * from `sheets.length`, or from `Date.now()` / `Math.random()`) because it has
   * to keep counting past ids that no longer exist: deleting sheet 3 and adding
   * one must give `s4`, never a second `s3` that would silently adopt the
   * deleted sheet's formatting, column types and merges.
   */
  nextOrdinal: number
}

const REGISTRY_KEY = 'tt.sheets.v1'

/** Longest name a tab will store — a guard on hand-edited / pasted registries. */
const MAX_NAME_LENGTH = 60

export const DEFAULT_SHEET_NAME = 'Sheet 1'

/**
 * The storage key a given store uses for a given sheet.
 *
 * Sheet 1 keeps the bare key so pre-tabs data is found where it already is; see
 * the migration note at the top of this file. Every other sheet is suffixed.
 */
export function sheetScopedKey(baseKey: string, sheetId: string): string {
  return sheetId === FIRST_SHEET_ID ? baseKey : `${baseKey}:${sheetId}`
}

/**
 * The registry a browser with no saved one gets: a single sheet on the bare keys.
 * Exported as `emptySheetRegistry` for the Settings "delete every sheet" reset,
 * which needs exactly this value — a workbook that has never been used — rather
 * than a hand-rolled copy that could drift from the real thing.
 */
function emptyRegistry(): SheetRegistry {
  return {
    version: 1,
    sheets: [{ id: FIRST_SHEET_ID, name: DEFAULT_SHEET_NAME }],
    activeId: FIRST_SHEET_ID,
    // 2, not 1: `s1` is spoken for by the pre-tabs keys and must never be
    // minted a second time.
    nextOrdinal: 2,
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Trim / clamp a tab name; empty input falls back to `fallback`. */
export function normalizeSheetName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') return fallback
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH)
  return trimmed || fallback
}

/**
 * The saved registry, repaired into something usable.
 *
 * Defensive in the same way every other store in this package is: a malformed
 * or denied read degrades to "one sheet on the pre-tabs keys", which is exactly
 * the state a first-run browser is in — so a corrupt registry shows the user
 * their original sheet rather than an empty app or a thrown render.
 *
 * The invariants enforced here are the ones the rest of the app is allowed to
 * assume: at least one sheet, no duplicate ids, `activeId` names a real sheet,
 * and `nextOrdinal` is past every id already in use.
 */
export function loadSheetRegistry(): SheetRegistry {
  try {
    if (typeof localStorage === 'undefined') return emptyRegistry()
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return emptyRegistry()
    const parsed: unknown = JSON.parse(raw)
    if (!isObject(parsed) || !Array.isArray(parsed.sheets)) return emptyRegistry()

    const seen = new Set<string>()
    const sheets: SheetInfo[] = []
    for (const entry of parsed.sheets) {
      if (!isObject(entry)) continue
      const id = typeof entry.id === 'string' ? entry.id.trim() : ''
      if (!id || seen.has(id)) continue
      seen.add(id)
      sheets.push({
        id,
        name: normalizeSheetName(entry.name, `Sheet ${sheets.length + 1}`),
      })
    }
    if (!sheets.length) return emptyRegistry()

    const activeId =
      typeof parsed.activeId === 'string' && seen.has(parsed.activeId)
        ? parsed.activeId
        : sheets[0].id

    // Never let the counter fall behind an id already in use: `s3` existing
    // while `nextOrdinal` is 2 would mint a colliding id on the next add.
    let nextOrdinal =
      typeof parsed.nextOrdinal === 'number' && Number.isFinite(parsed.nextOrdinal)
        ? Math.max(2, Math.trunc(parsed.nextOrdinal))
        : 2
    for (const sheet of sheets) {
      const match = /^s(\d+)$/.exec(sheet.id)
      if (match) nextOrdinal = Math.max(nextOrdinal, parseInt(match[1], 10) + 1)
    }

    return { version: 1, sheets, activeId, nextOrdinal }
  } catch {
    return emptyRegistry()
  }
}

/** Write the registry. Quota / private-mode denial is swallowed, as elsewhere. */
export function saveSheetRegistry(registry: SheetRegistry): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry))
  } catch {
    /* the tab strip still works for this session */
  }
}

/**
 * A registry with one more sheet appended and made active.
 *
 * Pure: it returns the next registry rather than writing, so the caller commits
 * it in the same step it points the stores at the new sheet — there is no window
 * in which storage says one thing and the singletons another.
 */
export function withNewSheet(registry: SheetRegistry): {
  registry: SheetRegistry
  sheet: SheetInfo
} {
  const ordinal = registry.nextOrdinal
  const sheet: SheetInfo = { id: `s${ordinal}`, name: `Sheet ${ordinal}` }
  return {
    registry: {
      ...registry,
      sheets: [...registry.sheets, sheet],
      activeId: sheet.id,
      nextOrdinal: ordinal + 1,
    },
    sheet,
  }
}

/** A registry with one sheet renamed. Unknown ids pass through untouched. */
export function withRenamedSheet(
  registry: SheetRegistry,
  sheetId: string,
  name: string,
): SheetRegistry {
  return {
    ...registry,
    sheets: registry.sheets.map((sheet) =>
      sheet.id === sheetId
        ? { ...sheet, name: normalizeSheetName(name, sheet.name) }
        : sheet,
    ),
  }
}

/**
 * A registry with one sheet removed, and the id that should now be active.
 *
 * Removing the LAST sheet is refused (`null`): zero sheets is not a state the
 * app can render, and silently substituting a blank one would destroy the user's
 * data on what reads as a no-op. The tab strip hides Delete when only one tab
 * is left, so this is the second line of the same defence.
 *
 * When the active sheet is the one going, the neighbour to its LEFT takes over
 * (or the new first sheet when it had none) — the tab the eye is already next to.
 */
export function withoutSheet(
  registry: SheetRegistry,
  sheetId: string,
): { registry: SheetRegistry; activeId: string } | null {
  if (registry.sheets.length <= 1) return null
  const index = registry.sheets.findIndex((sheet) => sheet.id === sheetId)
  if (index < 0) return null

  const sheets = registry.sheets.filter((sheet) => sheet.id !== sheetId)
  const activeId =
    registry.activeId === sheetId
      ? sheets[Math.max(0, index - 1)].id
      : registry.activeId
  return { registry: { ...registry, sheets, activeId }, activeId }
}

export { emptyRegistry as emptySheetRegistry }
