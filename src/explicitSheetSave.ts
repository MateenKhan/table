// Explicit, user-pressed Save — the Save button in the always-visible actions
// row — as opposed to the debounced autosave in App.
//
// ── Why this exists next to the autosave, rather than reusing it ────────────
// The autosave effect early-returns unless `standalone && isCustomSchema`: a
// sheet still sitting on the built-in demo / profile schema is deliberately NOT
// persisted, so a plain reload re-seeds the sample data instead of resurrecting
// rows the user never claimed as theirs. That policy is right for a BACKGROUND
// write — nobody asked for it, so it must not quietly adopt the demo.
//
// An explicit press is the opposite situation. The user pointing at the table
// and hitting Save IS the act of claiming it, and a Save button that silently
// does nothing on the sheet the app opens on would be a bug, not a policy. So
// this path saves whatever is on screen, demo-seeded or not, and the gate stays
// exactly where it is for the automatic path.
//
// The one-way door that opens: once saved, the sheet comes back on the next
// load (App reads `loadCustomSheet()` unconditionally in standalone mode) as a
// `customColumns` sheet — i.e. as the user's own sheet, which from then on the
// autosave gate does accept. That is the intended consequence: an explicit save
// promotes "the demo I was poking at" into "my sheet". Restore / Delete-all
// still call `clearCustomSheet()` and hand the demo back.
//
// ── Why the columns need work first ────────────────────────────────────────
// `PersistedSheet.customColumns` has to be plain JSON. A blank sheet's defs
// already are, but the demo / profile / consumer schemas are live TanStack
// defs full of functions (cell + header renderers, accessorFn, sort fns) that
// `JSON.stringify` drops on the floor — a header rendered as JSX would come
// back as `undefined` and the column would be unreadable. `serializeColumns`
// already solves exactly this for export/share (it even pulls display text out
// of a JSX header), so we route through it and then flatten the schema tree
// back into the plain def shape `customColumns` is read as on load.
//
// NOTE on the other two stores: per-cell formatting (`tableFormatting`) and
// per-column type overrides (`columnTypeOverrides`) each mirror themselves into
// localStorage from their own `notify()` on EVERY mutation, so they are already
// durable the instant the user applies them. Save must not — and does not —
// re-write them; doing so would only risk clobbering newer state with a stale
// copy. Column ids are preserved by the serialisation below, which is what keeps
// those two stores' keys pointing at the right cells after a reload.

import { serializeColumns, type ColumnSchemaNode } from './columnSchema'
import { trySaveCustomSheet } from './sheetPersistence'

/** What a Save attempt did, so the button can show the right state. */
export type SaveSheetResult = 'saved' | 'error'

/**
 * One serialised node → the plain, JSON-safe column def shape that
 * `customColumns` (and therefore the persisted sheet) is made of.
 *
 * Groups are kept as nested `{ id, header, columns }` defs — that is a valid
 * ColumnDef and every `customColumns` walker in App recurses through
 * `columns` — so a saved demo sheet keeps its "Name" grouping instead of
 * collapsing into a flat strip.
 *
 * The row-checkbox column is the one thing dropped: it is structural, is
 * rebuilt from a live def with renderers in it (`selectColumn`), and blank
 * sheets never carry one. Persisting a hollowed-out copy of it would restore a
 * dead, unrenderable column.
 */
function toPlainDefs(nodes: readonly ColumnSchemaNode[]): unknown[] {
  const out: unknown[] = []
  for (const node of nodes) {
    if (node.kind === 'group') {
      const children = toPlainDefs(node.columns)
      // A group whose only child was the checkbox has nothing left to show.
      if (!children.length) continue
      out.push({
        id: node.id ?? node.header ?? 'group',
        header: node.header ?? '',
        columns: children,
      })
      continue
    }
    if (node.role === 'select') continue
    const def: Record<string, unknown> = {
      id: node.id,
      accessorKey: node.accessorKey ?? node.id,
      // A string header, never a render function: the table's inline rename
      // seeds its editor from this.
      header: node.header ?? '',
    }
    if (node.meta) def.meta = node.meta
    if (typeof node.size === 'number') def.size = node.size
    if (node.enableSorting === false) def.enableSorting = false
    if (node.enableColumnFilter === false) def.enableColumnFilter = false
    if (node.enableGrouping === false) def.enableGrouping = false
    if (node.enableGlobalFilter === false) def.enableGlobalFilter = false
    out.push(def)
  }
  return out
}

/** The live column defs of any schema, as plain JSON-safe defs. */
export function persistableColumnDefs(defs: readonly unknown[]): unknown[] {
  return toPlainDefs(serializeColumns(defs))
}

/**
 * Persist the sheet on screen right now: its rows, its column definitions and
 * headers, and its formula sources. Never throws — a quota or serialisation
 * failure comes back as `'error'` for the button to surface, which is the whole
 * reason this returns anything at all.
 *
 * Caveat inherited from the autosave (not introduced here): an attachment held
 * as a `blob:` object URL is saved as its URL, and object URLs die with the
 * document. Seeded `data:` / `http:` attachments round-trip fine.
 */
export function saveSheetNow(
  input: {
    columns: readonly unknown[]
    data: readonly unknown[]
    formulas: Record<string, string>
  },
  /**
   * Which sheet (tab) to write under. Omitted = the active one, which is what
   * the Save button wants. App's sheet SWITCH passes the outgoing sheet's id
   * explicitly: it flushes the sheet being left after the user has already
   * asked for a different one, so "the active sheet" is the wrong answer by
   * then and would write A's rows under B's key.
   */
  sheetId?: string,
): SaveSheetResult {
  let payload: {
    customColumns: unknown[]
    data: unknown[]
    formulas: Record<string, string>
  }
  try {
    payload = {
      customColumns: persistableColumnDefs(input.columns),
      data: input.data as unknown[],
      formulas: input.formulas,
    }
  } catch {
    // A header renderer that throws on an empty context, a cyclic def — this
    // must never reach React as an unhandled error from an onClick.
    return 'error'
  }
  return trySaveCustomSheet(payload, sheetId) ? 'saved' : 'error'
}
