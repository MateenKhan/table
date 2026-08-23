import {
  ColumnFiltersState,
  ColumnOrderState,
  ColumnPinningState,
  RowPinningState,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  GroupingState,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import React from 'react'
import type { Person } from './makeData'

import { useSkipper } from './hooks'
import {
  columns as baseColumns,
  defaultColumn,
  getTableMeta,
  selectColumn,
  READ_ONLY_COLUMNS,
  SKIP_COLUMNS,
} from './tableModels'
import {
  serializeColumns,
  rebuildColumns,
  type ColumnSchemaNode,
} from './columnSchema'
import {
  buildMergedColumns,
  clearStoredMerges,
  collectColumnIds,
  ColumnMerge,
  loadStoredMerges,
  mergeIdFor,
  setColumnMergeSheet,
  storeMerges,
} from './columnMerge'
import {
  emptyGlobalSearch,
  GlobalSearchValue,
  globalSearchFilter,
  isGlobalSearchEmpty,
} from './globalSearch'
import { customFunctions, FormulaMap, recalcFormulas } from './formula'
import { buildRowPermutation } from './useRowDrag'
import {
  clearColumnTypesForSheet,
  columnTypeOverrides,
  resolveColumnMeta,
  useColumnTypeOverridesVersion,
} from './columnTypeOverrides'
import { formatCellValue, isAttachmentType } from './columnTypes'
import { FindHighlightProvider, findKey, type FindHighlight } from './tableFind'
import FindBar from './components/FindBar'
import {
  clearFormattingForSheet,
  tableFormatting,
  FONT_SIZE_OPTIONS,
  FONT_FAMILY_OPTIONS,
} from './formatting'
import {
  useColumnTypeRegistryVersion,
  columnTypeRegistry,
} from './columnTypeRegistry'
import CustomFunctionsDropdown, {
  loadStoredFunctions,
} from './components/CustomFunctionsDropdown'
import ControlGroup from './components/ControlGroup'
import ActionsRow from './components/ActionsRow'

// Restore saved definitions before the first recalculation runs.
loadStoredFunctions()
import CellSelectionProvider, {
  type SelectionScope,
  type CellEventInfo,
} from './useCellSelection'

// A light, serialisable description of a column, handed to `onColumnChange` so a
// host learns the current schema (id / header text / cell type) without seeing
// internal TanStack column defs.
export type ColumnInfo = { id: string; header: string; type?: string }
import useUndoHistory from './useUndoHistory'
import GlobalSearch from './components/GlobalSearch'
import PaginationControls from './components/PaginationControls'
import CustomTable from './components/CustomTable'
import {
  ReloadButton,
  DeleteAllButton,
} from './components/SheetLifecycleActions'
import ClearButton from './components/ClearButton'
import StatsBar from './components/StatsBar'
import FindReplaceDialog from './components/FindReplaceDialog'
import SettingsDialog from './components/SettingsDialog'
import { readSharedSnapshotFromUrl, type AppSnapshot } from './snapshot'
import { HelpCircle, Replace, Settings } from 'lucide-react'
import ThumbnailSizeProvider, { ThumbnailSize } from './thumbnailSize'
import { releaseAllAttachments, collectAttachmentUrls } from './attachments'
import {
  AttachmentConfigProvider,
  type AttachmentConfig,
} from './attachmentConfig'
import { usePartClass } from './theme'
import { blankColumns, blankRow, blankRows } from './blankSheet'
import {
  loadCustomSheet,
  saveCustomSheet,
  clearCustomSheet,
  setCustomSheetNamespace,
} from './sheetPersistence'
import { saveSheetNow } from './explicitSheetSave'
import SaveSheetButton from './components/SaveSheetButton'
import SheetTabs from './components/SheetTabs'
import {
  loadAccordionOpen,
  storeAccordionOpen,
} from './components/Accordion'
import {
  FIRST_SHEET_ID,
  DEFAULT_SHEET_NAME,
  emptySheetRegistry,
  loadSheetRegistry,
  saveSheetRegistry,
  withNewSheet,
  withRenamedSheet,
  withoutSheet,
  type SheetRegistry,
} from './sheetRegistry'
import {
  clearSheetView,
  loadSheetView,
  saveSheetView,
  toNumberMap,
} from './sheetView'

// ── Profiles / templates (optional, lazily-loaded site verticals) ──────
// Behind a lazy boundary so a build that drops src/templates/* still works, and
// so the default sheet never pays for this code.
import { resolveVertical } from './templates/resolveTemplate'
import { composeProfiles } from './templates/registry'
const TemplateSelector = React.lazy(
  () => import('./components/TemplateSelector'),
)

// Fold each column's user-chosen datatype (columnTypeOverrides) into its `meta`,
// walking group columns recursively. Once applied, the whole app (formatting,
// editing, query operators, the type picker's own display) sees the chosen type.
function applyTypeOverrides<T>(defs: T[]): T[] {
  return defs.map((raw) => {
    const def = raw as Record<string, unknown>
    if (Array.isArray(def.columns)) {
      return { ...def, columns: applyTypeOverrides(def.columns) } as T
    }
    const colId = (def.id ?? def.accessorKey) as string | undefined
    if (typeof colId !== 'string') return raw
    const meta = resolveColumnMeta(colId, def.meta as never)
    return meta === def.meta ? raw : ({ ...def, meta } as T)
  })
}

type AppProps = {
  // Consumer schema (library embed) — used as the base columns when provided.
  columns?: typeof baseColumns
  // Consumer initial rows (library embed).
  data?: Person[]
  // Rows per page. The embed renders no pagination controls, so leaving this
  // to TanStack's default of 10 makes every row past the tenth unreachable.
  pageSize?: number
  // true = the standalone demo app (default); false = embedded via the library
  // entry, which gates OFF all app-only machinery: URL/template routing,
  // localStorage persistence, and shared-view-on-load.
  standalone?: boolean
  // Injected by the DEMO entry (main.tsx) to seed/regenerate the random sample
  // rows. Kept out of App's static import graph on purpose: `makeData` pulls in
  // `@faker-js/faker` (~3 MB), which must NEVER ship inside the published
  // library bundle — only the demo build includes it. Absent → no sample data.
  makeDemoData?: () => Person[]
  // Blank-sheet size for a library embed with no `columns`/`data`: `cols`
  // generic text columns and `rows` empty rows the user fills in. Ignored once
  // explicit columns or data are given.
  rows?: number
  cols?: number
  // Fired after the grid's data changes (edit, fill, paste, clear, delete or
  // row reorder) with the full, current rows — how a library consumer reads
  // edits back out. Not fired for the initial mount.
  onDataChange?: (rows: Person[]) => void
  // Fired for each individual cell whose value changes (typing, fill, paste,
  // clear, undo/redo), with the data-row index, column id and new value.
  onCellChange?: (rowIndex: number, columnId: string, value: unknown) => void
  // Fired when the column model changes (add / remove / rename / retype /
  // reorder / hide) with a light description of the current columns.
  onColumnChange?: (columns: ColumnInfo[]) => void
  // Fired when the selection changes, with a coordinate-free description of what
  // is covered (kind + the data-row indices and column ids it spans).
  onSelectionChange?: (scope: SelectionScope) => void
  // Cell interaction hooks (see CellSelectionProvider): activation (click or
  // keyboard), click, and keydown-on-the-active-cell.
  onCellActivate?: (info: CellEventInfo) => void
  onCellClick?: (info: CellEventInfo, event: React.MouseEvent) => void
  onCellKeyDown?: (info: CellEventInfo, event: KeyboardEvent) => void
  // Fired on a column header / letter (A, B, C…) click and a row-number gutter
  // (1, 2, 3…) click, with the column id / data-row index and the native event.
  onColumnHeaderClick?: (columnId: string, event: React.MouseEvent) => void
  onRowHeaderClick?: (rowIndex: number, event: React.MouseEvent) => void
  // ── Attachments / uploads (file + image columns) ──────────────────────────
  // The full attachment config (size limit, size-limit handler, upload-to-server
  // hook, and low-level upload events). Threaded to every attachment cell.
  attachmentConfig?: AttachmentConfig
  // Max bytes per file inline-embedded into an exported snapshot. Larger files
  // export as references (they need re-uploading on another machine). Undefined
  // = embed everything regardless of size.
  exportEmbedLimit?: number
}

// Stable identity so an embed that passes no attachment config never re-renders
// the provider needlessly.
const EMPTY_ATTACHMENT_CONFIG: AttachmentConfig = {}

// How many empty rows "Delete everything" leaves behind — a blank sheet the user
// starts typing into.
const BLANK_SHEET_ROWS = 20

/*
 * Rows per page in the standalone app.
 *
 * It was 10, and 10 is smaller than a blank sheet: wiping to `BLANK_SHEET_ROWS`
 * empty rows produced TWO pages, so the pager appeared — with its arrows, its
 * page counter and its rows-per-page box — over a sheet with nothing in it at
 * all. The toolbar already hides the pager below two pages (see the
 * 'pagination' action), and this is the other half of the same fix: the default
 * page has to be big enough that the empty sheet is one page. Sized a little
 * above the blank sheet so the first few rows a user adds do not summon it
 * either; real data past 25 rows still pages, which is what a pager is for.
 */
const STANDALONE_PAGE_SIZE = 25

/**
 * Point every sheet-namespaced store at one sheet, in one place.
 *
 * Four stores keep their own localStorage key and three of them are module
 * singletons read from the render hot path (`resolveFormat` is called once per
 * painted cell), so a sheet switch does not swap objects — it re-aims the
 * singletons. This function is the ONLY place that knows all four need re-aiming
 * together: forgetting one is how sheet 2 ends up wearing sheet 1's colours, and
 * that bug stays invisible until a second sheet has content in it.
 *
 * Each `useSheet` flushes what it is holding under the OUTGOING key before it
 * rehydrates from the incoming one, so this is safe to call with unsaved work on
 * screen. The two plain-function stores (merges, custom sheet) have no in-memory
 * state of their own — App holds it — so they only need the namespace moved;
 * flushing THEIR outgoing bytes is the caller's job (see `moveActiveSheet`).
 */
function pointStoresAtSheet(sheetId: string): void {
  tableFormatting.useSheet(sheetId)
  columnTypeOverrides.useSheet(sheetId)
  setColumnMergeSheet(sheetId)
  setCustomSheetNamespace(sheetId)
}

/**
 * Erase everything one sheet owns. Called only from the tab strip's delete,
 * behind its confirm, and only for a sheet that is NOT the active one (the
 * caller switches away first) — so there is no live in-memory state to clear,
 * just five keys.
 *
 * Kept next to `pointStoresAtSheet` deliberately: they are the two halves of the
 * same list, and a store added to one without the other either leaks a deleted
 * sheet's bytes forever or bleeds them into the next sheet to claim the id.
 * (Ids are never reused — see `nextOrdinal` — so the failure here is a leak, not
 * a bleed. It is still a bug.)
 */
function eraseSheetStorage(sheetId: string): void {
  clearCustomSheet(sheetId)
  clearStoredMerges(sheetId)
  clearFormattingForSheet(sheetId)
  clearColumnTypesForSheet(sheetId)
  clearSheetView(sheetId)
}

export const App = ({
  columns: columnsProp,
  data: dataProp,
  standalone = true,
  makeDemoData,
  rows: rowsProp,
  cols: colsProp,
  pageSize: pageSizeProp,
  onDataChange,
  onCellChange,
  onColumnChange,
  onSelectionChange,
  onCellActivate,
  onCellClick,
  onCellKeyDown,
  onColumnHeaderClick,
  onRowHeaderClick,
  attachmentConfig,
  exportEmbedLimit,
}: AppProps = {}) => {
  // Consumer theming hook for the whole-app root surface.
  const rootPartClass = usePartClass('root')
  // Stable identity for the (usually empty) attachment config.
  const resolvedAttachmentConfig = attachmentConfig ?? EMPTY_ATTACHMENT_CONFIG
  const generateDemoRows = makeDemoData ?? ((): Person[] => [])
  // Which vertical the URL selected (null = default; never in library mode).
  const activeVertical = React.useMemo(
    () => (standalone ? resolveVertical() : null),
    [standalone],
  )

  // ── Sheets (tabs) ──────────────────────────────────────────────────────────
  //
  // STANDALONE, AND NOT A VERTICAL. Two exclusions, for two different reasons:
  //
  //   • A library embed is one grid the host has placed on its own page: the
  //     host owns the surrounding chrome, decides what a "document" is, and may
  //     well render several `<SpreadsheetTable/>`s that would fight over one
  //     registry. `lib.tsx` passes `standalone={false}`.
  //   • A vertical (a profile-composed site sheet, selected by URL) already has
  //     its own answer to "what is this sheet": it is composed fresh from the
  //     selected profiles on every change and deliberately never persists — the
  //     profile-change effect calls `clearCustomSheet()` precisely so it cannot.
  //     Tabs would have to flush a sheet that mode has decided not to keep.
  //
  // Both fall back to the SINGLE FIXED namespace the app has always used
  // (`FIRST_SHEET_ID`, i.e. the bare storage keys), so their persistence is
  // byte-for-byte what it was before tabs existed, and neither renders the strip.
  //
  // The initializer POINTS THE FOUR NAMESPACED STORES at the active sheet, and it
  // has to happen here — before `loadCustomSheet()` two lines down, before
  // `loadStoredMerges()` further on, and before the first cell asks
  // `resolveFormat` for its colours. Everything that reads a sheet's bytes runs
  // after this line, which is why it is a `useState` initializer and not an
  // effect: an effect runs after the first render has already read the wrong
  // sheet. It is idempotent, so StrictMode's double-invoke is inert.
  const sheetsEnabled = standalone && !activeVertical
  // Whether the search + actions band under the tab strip is showing. Collapsing
  // it is the one way to give the grid a large amount of the window back — the
  // band is ~44px of chrome that a user reading hundreds of rows does not need
  // on screen. Remembered across reloads through the same tiny localStorage
  // helper the old Accordion used, so a user who works collapsed stays that way.
  //
  // Only reachable when the tab strip renders (`sheetsEnabled`), because the
  // toggle lives on it. A library embed therefore always shows its chrome, which
  // is right: a host that does not want the toolbar simply does not render one,
  // and a hidden toolbar with no visible way back would be a trap.
  const [chromeOpen, setChromeOpen] = React.useState(() =>
    loadAccordionOpen('chrome', true),
  )
  const toggleChrome = React.useCallback(() => {
    setChromeOpen((open) => {
      const next = !open
      storeAccordionOpen('chrome', next)
      return next
    })
  }, [])

  const [registry, setRegistry] = React.useState<SheetRegistry>(() => {
    if (!sheetsEnabled) {
      return {
        version: 1,
        sheets: [{ id: FIRST_SHEET_ID, name: DEFAULT_SHEET_NAME }],
        activeId: FIRST_SHEET_ID,
        nextOrdinal: 2,
      }
    }
    const loaded = loadSheetRegistry()
    pointStoresAtSheet(loaded.activeId)
    return loaded
  })
  const activeSheetId = registry.activeId

  // A sheet the user previously built (Delete-all → filled in) survives reloads;
  // read it once at mount. When present it takes priority over the demo / profile
  // seed, so the user's own data is what comes back — not the sample rows.
  // Namespaced: this reads the ACTIVE sheet's key, because the initializer above
  // already pointed the stores at it.
  const persistedSheetRef = React.useRef(
    standalone ? loadCustomSheet() : null,
  )
  const persistedSheet = persistedSheetRef.current
  const [selectedProfileIds, setSelectedProfileIds] = React.useState<string[]>(
    () => activeVertical?.defaultSelected ?? [],
  )
  // The composed sheet for the current selection. null → fall back to the
  // default table (no vertical, or a vertical with nothing selected).
  const composed = React.useMemo(
    () =>
      activeVertical && selectedProfileIds.length
        ? composeProfiles(activeVertical, selectedProfileIds)
        : null,
    [activeVertical, selectedProfileIds],
  )

  // A blank N×M sheet for a library embed given `rows`/`cols` but no explicit
  // columns/data: `cols` generic text columns (col1…colN) and `rows` empty rows.
  const blankSheet = React.useMemo(() => {
    if (standalone || columnsProp || dataProp) return null
    if (!colsProp && !rowsProp) return null
    const columns = blankColumns(
      Math.max(1, colsProp ?? 6),
    ) as unknown as typeof baseColumns
    const ids = columns.map((c) => String((c as { id: string }).id))
    return {
      columns,
      data: blankRows(Math.max(0, rowsProp ?? 0), ids) as unknown as Person[],
    }
  }, [standalone, columnsProp, dataProp, colsProp, rowsProp])

  const [data, setData] = React.useState<Person[]>(() => {
    // A consumer's `data` prop always wins, then a `rows`/`cols` blank sheet; a
    // library embed with nothing starts empty. Otherwise the standalone demo
    // restores a saved sheet / profile / random sample as before.
    if (dataProp) return dataProp
    if (blankSheet) return blankSheet.data
    if (!standalone) return []
    if (persistedSheet) return persistedSheet.data as unknown as Person[]
    if (activeVertical && activeVertical.defaultSelected?.length) {
      return composeProfiles(activeVertical, activeVertical.defaultSelected)
        .data as unknown as Person[]
    }
    return generateDemoRows()
  })
  // Formula sources live beside the data, keyed by `${dataRowIndex}:${columnId}`.
  // `data` still holds the computed result, so sorting / filtering / search all
  // keep working against real values.
  const [formulas, setFormulas] = React.useState<FormulaMap>(
    () => (persistedSheet ? (persistedSheet.formulas as FormulaMap) : {}),
  )

  // Surface data edits to a library consumer. `data` already holds computed
  // formula results, so the callback always sees the effective rows. The very
  // first render is the initial data the consumer passed in, so it is skipped —
  // only real changes fire.
  const onDataChangeRef = React.useRef(onDataChange)
  onDataChangeRef.current = onDataChange
  const dataMountedRef = React.useRef(false)
  React.useEffect(() => {
    if (!dataMountedRef.current) {
      dataMountedRef.current = true
      return
    }
    onDataChangeRef.current?.(data)
  }, [data])

  const [autoResetPageIndex, skipAutoResetPageIndex] = useSkipper()

  // `onCellChange` fires from inside the table meta's cell writers (the single
  // path every edit / fill / paste / clear / undo-redo flows through). Read
  // through a ref so the memoised meta always calls the latest callback.
  const onCellChangeRef = React.useRef(onCellChange)
  onCellChangeRef.current = onCellChange

  // Appending rows needs the current schema, which is declared much further down
  // (`customColumns`), so the callback is reached through a ref: `tableMeta`
  // itself has to stay one memoised instance for the life of the table.
  const appendRowsRef = React.useRef<(count: number) => void>(() => {})

  // One instance for the life of the table: the undo stacks are keyed to the
  // rows currently in `data`, and `updateCells` is how a patch is replayed.
  const tableMeta = React.useMemo(
    () => ({
      ...getTableMeta(setData, skipAutoResetPageIndex, (rowIndex, columnId, value) =>
        onCellChangeRef.current?.(rowIndex, columnId, value),
      ),
      // How the grid grows the sheet when a paste is taller than it. Optional
      // as far as the grid is concerned — see the note on `meta()` in
      // `useCellSelection`.
      appendRows: (count: number) => appendRowsRef.current(count),
    }),
    [skipAutoResetPageIndex],
  )

  const history = useUndoHistory({
    applyCells: tableMeta.updateCells,
    setFormulas,
  })

  const refreshData = () => {
    setFormulas({})
    // Every row index the history points at is about to mean something else,
    // so the stacks go with the data rather than being replayed onto rows
    // that no longer exist.
    history.clear()
    // Every uploaded blob is about to become unreachable, so hand it back to
    // the browser rather than leaking it for the life of the tab.
    releaseAllAttachments()
    // Restore discards the user's saved sheet and returns to the built-in demo
    // schema + data (this is the "bring the data back" action).
    if (standalone) clearCustomSheet()
    setCustomColumns(null)
    setImportedColumns(null)
    setRowHeights({})
    // Regenerate from the active profiles when a vertical is loaded, else the
    // demo's random data — or, in a library embed, the caller's initial rows.
    setData(
      composed
        ? (composed.data as unknown as Person[])
        : standalone
          ? generateDemoRows()
          : (dataProp ?? []),
    )
  }

  // Re-seed the sheet whenever the profile selection changes (but not on first
  // mount — the useState initializer already seeded it).
  // Re-seed only when the profile selection ACTUALLY changes. We compare the
  // previous `composed` value rather than using a "skip first mount" flag: under
  // React StrictMode the effect double-invokes on mount, and a flag-based guard
  // would let the second pass fire and wipe a restored blank sheet. A value
  // compare is inert on mount (and on the StrictMode remount) and runs only on a
  // genuine profile change.
  const prevComposedRef = React.useRef(composed)
  React.useEffect(() => {
    if (prevComposedRef.current === composed) return
    prevComposedRef.current = composed
    setFormulas({})
    history.clear()
    releaseAllAttachments()
    // Switching profiles adopts that profile's schema, so a user's blank sheet
    // (if any) is discarded — including its saved copy.
    clearCustomSheet()
    setCustomColumns(null)
    setImportedColumns(null)
    setRowHeights({})
    // A vertical with nothing selected shows an empty sheet rather than the
    // random demo data — the demo only belongs to the default (no-vertical) site.
    setData(
      composed
        ? (composed.data as unknown as Person[])
        : activeVertical
          ? []
          : generateDemoRows(),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composed])

  // Global row/thumbnail size is M for the media-heavy demo; per-row height is
  // set via the row popup / gutter drag. A user-built blank sheet is text-only,
  // so it defaults to the compact S rows (see the provider below).
  const [thumbnailSize] = React.useState<ThumbnailSize>('M')

  // Last line of defence against leaked object URLs.
  React.useEffect(() => releaseAllAttachments, [])

  const [columnVisibility, setColumnVisibility] = React.useState({})
  const [grouping, setGrouping] = React.useState<GroupingState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnPinning, setColumnPinning] =
    React.useState<ColumnPinningState>({})
  // Frozen rows — pinned to the top so they stay put while the rest scrolls
  // (two-tables-in-one).
  const [rowPinning, setRowPinning] = React.useState<RowPinningState>({
    top: [],
    bottom: [],
  })
  // Flat leaf order, written by the header drag. Empty means "definition
  // order"; every commit from the drag layer is a full permutation.
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  )
  const [globalFilter, setGlobalFilter] =
    React.useState<GlobalSearchValue>(emptyGlobalSearch)
  // Per-row heights (data-row index → px), lifted here so a resized row is part
  // of the exported/cloned view. CustomTable drives it as a controlled prop.
  const [rowHeights, setRowHeights] = React.useState<Record<number, number>>({})

  // A user-authored schema. `null` means "use the built-in schema" (the demo /
  // profile columns); once the user wipes the table with Delete-all they get a
  // blank sheet of generic `col1..colN` columns held here, which they can then
  // rename, extend (add column), and fill (add row) to store their own data.
  const [customColumns, setCustomColumns] = React.useState<
    typeof baseColumns | null
  >(() => {
    // A `rows`/`cols` blank sheet supplies its own generic columns.
    if (blankSheet) return blankSheet.columns
    return persistedSheet
      ? (persistedSheet.customColumns as unknown as typeof baseColumns)
      : null
  })
  const isCustomSchema = customColumns !== null

  // A full schema rebuilt from an imported snapshot's `columnSchema`. This is the
  // "clone" channel: when set it becomes the table's columns wholesale, so an
  // import reproduces the exported table's structure (groups, headers, types,
  // order) — not just its data mapped onto whatever columns the host had. Unlike
  // `customColumns` it does NOT flip the app into blank-sheet mode (thumbnails,
  // per-column edit UI stay normal). `null` → no import in effect.
  const [importedColumns, setImportedColumns] = React.useState<
    typeof baseColumns | null
  >(null)

  // Persist the user's own sheet (debounced) whenever it changes — but ONLY the
  // custom schema. The demo / profile sheet is intentionally never saved, so a
  // plain reload re-seeds the sample data while a sheet the user actually built
  // (rows + headers + formulas) survives the reload.
  //
  // The write names its sheet EXPLICITLY rather than letting the store use
  // whichever sheet is active when the timer fires. React does clear the pending
  // timer on a switch (every dep below changes), so in practice the stale timer
  // never runs — but "sheet A's rows written under sheet B's key" is a
  // data-corrupting bug, and it must not be contingent on effect-cleanup timing.
  // Capturing the id in the closure makes it impossible instead of unlikely.
  React.useEffect(() => {
    if (!standalone || !isCustomSchema || !customColumns) return
    const sheetId = activeSheetId
    const id = window.setTimeout(() => {
      saveCustomSheet(
        {
          customColumns: customColumns as unknown as unknown[],
          data: data as unknown as unknown[],
          formulas,
        },
        sheetId,
      )
    }, 400)
    return () => window.clearTimeout(id)
  }, [standalone, isCustomSchema, customColumns, data, formulas, activeSheetId])

  // ── Actions-bar data operations ────────────────────────────────────────────
  // "Delete all" is a full wipe of the ACTIVE SHEET (the current tab) → a blank
  // sheet. It has never meant "every sheet", and since tabs landed its confirm
  // says so. Unlike deleting rows, this also
  // clears the HEADERS: the schema is replaced with generic `Column 1..N` columns
  // the user renames + fills to store their own data. Everything scoped to the
  // old schema (formulas, merges, per-cell formatting, type overrides, uploaded
  // blobs) is dropped so nothing bleeds across.
  const deleteAllTable = React.useCallback(() => {
    const cols = blankColumns(6)
    const ids = cols.map((c) => String(c.id))
    setFormulas({})
    history.clear()
    releaseAllAttachments()
    setMerges([])
    tableFormatting.restore(null)
    columnTypeOverrides.restore(null)
    setCustomColumns(cols as unknown as typeof baseColumns)
    setImportedColumns(null)
    setRowHeights({})
    setData(blankRows(BLANK_SHEET_ROWS, ids) as unknown as Person[])
  }, [history])

  // The next free `colN` id for the blank sheet, so added columns never collide.
  const nextBlankColumnId = (cols: typeof baseColumns) => {
    let max = 0
    for (const c of cols) {
      const m = /^col(\d+)$/.exec(String(c.id ?? ''))
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max + 1
  }

  // A fresh generic column def (empty header — the user names it by double-click).
  const makeBlankColumn = (id: string): (typeof baseColumns)[number] =>
    ({
      id,
      accessorKey: id,
      header: '',
      meta: { type: 'text' },
    }) as unknown as (typeof baseColumns)[number]

  // Append a new blank column (blank-sheet mode only). Also seed the key on every
  // existing row so the new cells are addressable immediately.
  const addColumn = React.useCallback(() => {
    setCustomColumns((prev) => {
      if (!prev) return prev
      const id = `col${nextBlankColumnId(prev)}`
      setData((rows) =>
        rows.map((r) => ({ ...(r as object), [id]: '' }) as unknown as Person),
      )
      return [...prev, makeBlankColumn(id)]
    })
  }, [])

  // Insert a blank column immediately left / right of the given one.
  // Insert one empty row above / below `dataRowIndex`, for any schema. Row
  // indices shift, so — like row delete / reorder — formulas and the undo
  // history (both keyed by index) are cleared rather than replayed onto the
  // wrong rows.
  const insertRow = React.useCallback(
    (dataRowIndex: number, side: 'above' | 'below') => {
      setFormulas({})
      history.clear()
      setData((prev) => {
        const row = (
          customColumns ? blankRow(customColumns.map((c) => String(c.id))) : {}
        ) as unknown as Person
        const at = side === 'above' ? dataRowIndex : dataRowIndex + 1
        const clamped = Math.max(0, Math.min(at, prev.length))
        return [...prev.slice(0, clamped), row, ...prev.slice(clamped)]
      })
    },
    [customColumns, history],
  )

  // (`deleteColumn` lives next to `insertColumnAt` further down: it needs the
  // same materialise-the-schema-first machinery, which is only in scope there.)

  // Append one empty row. In blank-sheet mode it carries every custom column id;
  // otherwise an empty object reads as blank cells against the default schema.
  const addRow = React.useCallback(() => {
    setData((rows) => {
      const row = customColumns
        ? blankRow(customColumns.map((c) => String(c.id)))
        : {}
      return [...rows, row as unknown as Person]
    })
  }, [customColumns])

  // Append `count` blank rows at the END of the sheet. This is what lets a paste
  // grow the grid instead of silently dropping the rows that would not fit.
  //
  // Appending is the ONLY structural row edit that can happen silently: every
  // existing row keeps its data index, so formulas and the undo history — both
  // keyed by index — stay valid and are deliberately NOT cleared here. Insert,
  // delete and reorder all have to clear them (see `insertRow` / `deleteRows`),
  // which is exactly why paste grows downwards and never inserts.
  const appendRows = React.useCallback(
    (count: number) => {
      if (count <= 0) return
      // Adding rows must not bounce the user back to page 1 mid-paste — that
      // would wipe the (screen-coordinate) selection out from under them.
      skipAutoResetPageIndex()
      setData((rows) => {
        const ids = customColumns ? customColumns.map((c) => String(c.id)) : null
        const extra: Person[] = []
        for (let i = 0; i < count; i++) {
          extra.push((ids ? blankRow(ids) : {}) as unknown as Person)
        }
        return [...rows, ...extra]
      })
    },
    [customColumns, skipAutoResetPageIndex],
  )
  appendRowsRef.current = appendRows

  const deleteRows = React.useCallback(
    (rowIndices: number[]) => {
      const drop = new Set(rowIndices)
      // Row indices are about to shift, so the formula/undo state that pointed
      // at them can no longer be replayed onto the right rows.
      setFormulas({})
      history.clear()
      setData((prev) => prev.filter((_, i) => !drop.has(i)))
    },
    [history],
  )

  // Drag-to-reorder a row: move the row at `from` to sit before original index
  // `to` (== data.length → append at the end). Only ever called when the visible
  // order equals the data order (CustomTable gates the drag on that), so a splice
  // on the raw array is exactly what the user sees.
  const reorderRows = React.useCallback(
    (from: number, to: number) => {
      const n = data.length
      if (from < 0 || from >= n || to < 0 || to > n) return
      const oldToNew = buildRowPermutation(n, from, to)

      setData((prev) => {
        const next = [...prev]
        const [moved] = next.splice(from, 1)
        const insertAt = to > from ? to - 1 : to
        next.splice(insertAt, 0, moved)
        return next
      })

      // Formulas are keyed `${dataRowIndex}:${columnId}`, so each key's row index
      // is rewritten through the same permutation — the formula follows its row.
      setFormulas((prev) => {
        const keys = Object.keys(prev)
        if (!keys.length) return prev
        const next: FormulaMap = {}
        for (const key of keys) {
          const sep = key.indexOf(':')
          const rowIndex = Number(key.slice(0, sep))
          const columnId = key.slice(sep + 1)
          const mapped = oldToNew[rowIndex] ?? rowIndex
          next[`${mapped}:${columnId}`] = prev[key]
        }
        return next
      })

      // The undo stacks are keyed to the old row indices, so they can no longer
      // be replayed onto the right rows once the order changes.
      history.clear()
    },
    [data.length, history],
  )

  // Promote a selected row to the header row: copy its cell values into the
  // column headers, then delete the row. Blank-sheet only (needs custom columns).
  const promoteRowToHeader = React.useCallback(
    (dataRowIndex: number) => {
      const rowVals = data[dataRowIndex] as Record<string, unknown> | undefined
      if (!rowVals) return
      setCustomColumns((prev) =>
        prev
          ? prev.map((c) => {
              const v = rowVals[String(c.id)]
              return { ...c, header: v == null ? '' : String(v) }
            })
          : prev,
      )
      deleteRows([dataRowIndex])
    },
    [data, deleteRows],
  )

  const mergeColumns = React.useCallback((columnIds: string[]) => {
    if (columnIds.length < 2) return
    const claimed = new Set(columnIds)
    setMerges((prev) => [
      // A column can only belong to one merge, so drop any that overlap.
      ...prev.filter((m) => !m.columnIds.some((c) => claimed.has(c))),
      { id: mergeIdFor('group', columnIds), mode: 'group', header: 'Merged', columnIds },
    ])
  }, [])

  // Settings (format profiles + saved queries + export/share) and Find dialogs.
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [findOpen, setFindOpen] = React.useState(false)
  // The element the contextual ops strip portals into — a slot in the actions
  // div, so no actions live inside the table.
  const [opsSlot, setOpsSlot] = React.useState<HTMLElement | null>(null)

  // Browser-style "find in table" bar (Ctrl+F): highlight matches + step through
  // them. Distinct from the query builder (`q`, filters rows) and Find & replace
  // (Ctrl+H, bulk edit).
  const [findBarOpen, setFindBarOpen] = React.useState(false)
  const [findText, setFindText] = React.useState('')
  const [findIndex, setFindIndex] = React.useState(0)
  const findInputRef = React.useRef<HTMLInputElement>(null)
  // Refs so the window-level keydown handler (mounted once) can reach the latest
  // find state / navigator without re-subscribing.
  const findBarOpenRef = React.useRef(false)
  findBarOpenRef.current = findBarOpen
  const gotoMatchRef = React.useRef<(dir: 1 | -1) => void>(() => {})

  // Ctrl+H opens Find & replace (unless typing in a field).
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.key === 'h' || e.key === 'H') || !(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      setFindOpen(true)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])
  const queryRef = React.useRef<HTMLDivElement>(null)
  const openHelp = React.useCallback(() => {
    // The grid's keyboard layer owns the shortcuts modal and toggles it on '?'.
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: '?', shiftKey: true, bubbles: true }),
    )
  }, [])

  // Focus the search / query bar via keyboard:
  //   • Ctrl/Cmd+F — always, overriding the browser's page-find.
  //   • `q`        — when a cell (not an input) is focused, so type-to-edit is
  //                  never hijacked.
  // Capture phase + stopPropagation so it wins over the grid's own handlers.
  React.useEffect(() => {
    const focusSearch = () => {
      requestAnimationFrame(() => {
        queryRef.current
          ?.querySelector<HTMLElement>('input, [role="combobox"]')
          ?.focus()
      })
    }
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd+F → open the browser-style find-in-table bar (not the browser's
      // own find). Focus + select its input so an existing query is replaceable.
      if (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === 'f' || e.key === 'F')
      ) {
        e.preventDefault()
        e.stopPropagation()
        setFindBarOpen(true)
        requestAnimationFrame(() => {
          findInputRef.current?.focus()
          findInputRef.current?.select()
        })
        return
      }
      // F3 / Shift+F3 → next / previous match while the find bar is open.
      if (e.key === 'F3' && findBarOpenRef.current) {
        e.preventDefault()
        e.stopPropagation()
        gotoMatchRef.current(e.shiftKey ? -1 : 1)
        return
      }
      // Ctrl+Q → focus the search.
      //
      // This was a bare `q`, guarded by "not already in an input". That guard
      // is not enough in a grid: selecting a cell and typing is how you edit,
      // so the FIRST character lands while focus is still on the grid, not an
      // input. Every value starting with q — quantity, qty, Q1 — lost its
      // first keystroke to the search box.
      //
      // Ctrl, never Cmd: ⌘Q quits the application on macOS.
      if ((e.key !== 'q' && e.key !== 'Q') || !e.ctrlKey || e.metaKey || e.altKey)
        return
      e.preventDefault()
      e.stopPropagation()
      focusSearch()
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Bumped whenever a custom function is defined, edited or removed.
  const customFunctionsVersion = React.useSyncExternalStore(
    React.useCallback(
      (listener: () => void) => customFunctions.subscribe(listener),
      [],
    ),
    () => customFunctions.version,
  )

  // Rebuild the columns whenever a column's chosen datatype (or a custom unit)
  // changes, so the new type flows into meta.
  const typeOverridesVersion = useColumnTypeOverridesVersion()
  const typeRegistryVersion = useColumnTypeRegistryVersion()

  // The column definitions are derived state: `baseColumns` stays the source of
  // truth and every merge the user makes is a descriptor folded over it. The
  // memo is what keeps `columns` referentially stable between renders, which
  // useReactTable needs to avoid rebuilding the whole column model.
  // A loaded vertical brings its own schema, so it starts with no merges and
  // does not read/write the default sheet's persisted merges (keeping the two
  // from contaminating each other).
  const [merges, setMerges] = React.useState<ColumnMerge[]>(() =>
    activeVertical || !standalone ? [] : loadStoredMerges(),
  )
  // `baseColumns` is the default schema. Priority, highest first: an imported
  // clone schema wins over everything; then a user's blank sheet; then a composed
  // profile sheet; then the consumer's / built-in columns.
  const effectiveBaseColumns = importedColumns
    ? importedColumns
    : customColumns
      ? customColumns
      : composed
        ? (composed.columns as unknown as typeof baseColumns)
        : (columnsProp ?? baseColumns)
  const columns = React.useMemo(
    () =>
      applyTypeOverrides(buildMergedColumns(effectiveBaseColumns, merges)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveBaseColumns, merges, typeOverridesVersion, typeRegistryVersion],
  )

  // Materialise the current (built-in / consumer) schema into an editable clone,
  // so a structural edit on a table the user did not author can still stick.
  const materializeSchema = React.useCallback(
    () =>
      rebuildColumns(
        serializeColumns(effectiveBaseColumns),
        selectColumn,
      ) as unknown as typeof baseColumns,
    [effectiveBaseColumns],
  )

  // Explicit Save (the actions-row button), the counterpart to the debounced
  // autosave further up.
  //
  // It deliberately does NOT re-check that effect's `isCustomSchema` gate. The
  // gate protects a BACKGROUND write from quietly adopting the demo data as if
  // it were the user's; a press of Save is the user saying it IS theirs, so the
  // gate has nothing left to protect and refusing here would make the button a
  // silent no-op on the very sheet the app opens on. (The load path needs no
  // change to match: App reads `loadCustomSheet()` unconditionally in
  // standalone mode at mount, so whatever this writes is what comes back — as a
  // `customColumns` sheet, which the autosave gate then accepts from that point
  // on. Restore / Delete-all still call `clearCustomSheet()`.)
  //
  // It saves `effectiveBaseColumns`, the PRE-merge schema, exactly as the
  // exporter does: column merges are a separate descriptor layer with its own
  // localStorage mirror, as are per-cell formatting and column-type overrides,
  // and each of those already persists itself on every change — Save must not
  // write stale copies over them.
  //
  // Placed here rather than beside the autosave only because
  // `effectiveBaseColumns` is declared above it.
  const saveSheetExplicitly = React.useCallback(
    () =>
      saveSheetNow({
        columns: effectiveBaseColumns as unknown as unknown[],
        data: data as unknown as unknown[],
        formulas,
      }),
    [effectiveBaseColumns, data, formulas],
  )

  // Rename a column's header, whatever schema it came from.
  //
  // This used to touch `customColumns` only, so renaming was silently a no-op
  // on every sheet the user had not authored themselves — including the demo
  // the app opens on. A rename is a structural edit like inserting a column, so
  // it takes the same three-way path: edit the blank sheet in place, edit an
  // imported clone in place, or materialise the built-in schema into an
  // editable clone first. (Hence its position here, after `materializeSchema`.)
  //
  // The walk recurses so a column nested under a group is reachable, and
  // matches group nodes too — whether a group header may be renamed is
  // CustomTable's call, not this function's.
  const renameColumn = React.useCallback(
    (columnId: string, name: string) => {
      const edit = (defs: typeof baseColumns): typeof baseColumns => {
        const walk = (arr: unknown[]): unknown[] =>
          arr.map((raw) => {
            const def = raw as Record<string, unknown>
            const next =
              String(def.id ?? def.accessorKey) === columnId
                ? { ...def, header: name }
                : def
            return Array.isArray(next.columns)
              ? { ...next, columns: walk(next.columns) }
              : next
          })
        return walk(defs) as typeof baseColumns
      }

      if (customColumns) setCustomColumns((prev) => (prev ? edit(prev) : prev))
      else if (importedColumns)
        setImportedColumns((prev) => (prev ? edit(prev) : prev))
      else setImportedColumns(edit(materializeSchema()))
    },
    [customColumns, importedColumns, materializeSchema],
  )

  // Merges are plain descriptors, so they survive a reload like custom
  // functions do — but only for the default sheet (see above).
  //
  // Named sheet, same reasoning as the autosave above: `merges` and
  // `activeSheetId` change in the SAME commit on a switch (both setters run in
  // one handler), so passing the id from this render's scope can only ever write
  // the merges that belong to it.
  React.useEffect(() => {
    if (!activeVertical && standalone) storeMerges(merges, activeSheetId)
  }, [merges, activeVertical, standalone, activeSheetId])

  const readOnlyColumns = React.useMemo(
    () => [
      ...READ_ONLY_COLUMNS,
      // A combined column is derived from its sources, exactly like `fullName`,
      // so the editor, the fill handle and Delete all leave it alone.
      ...merges
        .filter((merge) => merge.mode === 'combine')
        .map((merge) => merge.id),
    ],
    [merges],
  )

  const table = useReactTable({
    data,
    columns,
    defaultColumn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    /*
     * Without this, pagination sits at TanStack's default of ten rows a page.
     * The standalone app has a pager in its toolbar so that is merely a page
     * size; the library embed renders no pager at all, so it was a hard cap
     * that dropped every row past the tenth with nothing on screen to say so.
     * An embed therefore defaults to showing everything it was handed.
     */
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize:
          pageSizeProp ??
          (standalone
            ? STANDALONE_PAGE_SIZE
            : Math.max(10, dataProp?.length ?? 0, rowsProp ?? 0)),
      },
    },
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    /*
     * Grouping without this produces groups you cannot open.
     *
     * TanStack builds the grouped tree from `getGroupedRowModel`, but the rows
     * underneath a group are only ever emitted by the EXPANDED row model.
     * Without it, grouping a 37-row sheet by status showed four rows, no
     * expander and no way back to the data — the grouping toolbar worked and
     * the feature was useless.
     */
    getExpandedRowModel: getExpandedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: globalSearchFilter,
    autoResetPageIndex,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    onColumnVisibilityChange: setColumnVisibility,
    onGroupingChange: setGrouping,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    // Frozen rows: keep them rendered even when filtered/paged out.
    enableRowPinning: true,
    keepPinnedRows: true,
    onRowPinningChange: setRowPinning,
    // The 'reorder' default yanks grouped columns to the front of the flat
    // order, which would silently undo whatever the drag just committed.
    groupedColumnMode: false,
    // Provide our updateData function to our table meta
    meta: tableMeta,
    state: {
      grouping,
      columnFilters,
      // undefined switches global filtering off entirely; an empty object
      // would otherwise filter every row out.
      globalFilter: isGlobalSearchEmpty(globalFilter) ? undefined : globalFilter,
      columnVisibility,
      columnPinning,
      columnOrder,
      rowSelection,
      rowPinning,
    },
    debugTable: true,
    debugHeaders: true,
    debugColumns: true,
  })

  // Resolve every displayed cell value into a plain data array. Columns that
  // render through an ACCESSOR FUNCTION (e.g. the demo's computed `fullName`)
  // keep their value only in the table, never in `data` — so a clone/export that
  // reads by key would show them blank. This folds those computed values back
  // into the rows by column id, making the data self-contained. Pass-through
  // (same ref) when there are no computed columns, so the common case is free.
  const resolveDisplayedData = React.useCallback((): Record<
    string,
    unknown
  >[] => {
    const rows = data as unknown as Record<string, unknown>[]
    const computed = table.getAllLeafColumns().filter((col) => {
      const def = col.columnDef as unknown as Record<string, unknown>
      return !def.accessorKey && typeof def.accessorFn === 'function'
    })
    if (!computed.length) return rows
    const coreRows = table.getCoreRowModel().rows
    return rows.map((row, i) => {
      const tableRow = coreRows[i]
      if (!tableRow) return row
      const out: Record<string, unknown> = { ...row }
      for (const col of computed) {
        if (!(col.id in out)) {
          try {
            out[col.id] = tableRow.getValue(col.id)
          } catch {
            /* an accessor that throws just leaves the cell blank */
          }
        }
      }
      return out
    })
  }, [data, table])

  // Apply a structural edit to whichever column tree is currently in charge:
  // the user's blank sheet, an imported clone, or — when neither exists yet —
  // the built-in schema, materialised into an editable clone on the spot so the
  // change has somewhere to live. This is the ONE place that three-way decision
  // is made; insert / delete both go through it.
  //
  // Every branch is a FUNCTIONAL setState, including the materialising one
  // (`prev ?? materializeSchema()`). That is what makes the edit composable: the
  // strip turns "3 columns selected → insert" into three calls in a single
  // event, and a non-functional `setImportedColumns(edit(materializeSchema()))`
  // would have had calls 2 and 3 each re-materialise from the ORIGINAL schema,
  // so only the last insert survived.
  const editSchema = React.useCallback(
    (edit: (defs: typeof baseColumns) => typeof baseColumns) => {
      if (customColumns) setCustomColumns((prev) => (prev ? edit(prev) : prev))
      else if (importedColumns)
        setImportedColumns((prev) => (prev ? edit(prev) : prev))
      else setImportedColumns((prev) => edit(prev ?? materializeSchema()))
    },
    [customColumns, importedColumns, materializeSchema],
  )

  // True when the next structural edit is the one that turns a built-in /
  // consumer schema into an editable clone. Computed columns (the demo's
  // `fullName`) live only in the table, never in `data`, so their values have to
  // be folded into the rows before the schema starts being read by key.
  const materializeRows = React.useCallback(() => {
    if (customColumns || importedColumns) return
    const resolved = resolveDisplayedData()
    if ((resolved as unknown) !== (data as unknown))
      setData(resolved as unknown as Person[])
  }, [customColumns, importedColumns, resolveDisplayedData, data])

  // Insert a blank column immediately left / right of `columnId`, in ANY schema —
  // flat or grouped, built-in or user-authored. When the schema is not yet
  // user-owned it is materialised first (so the change persists), then the new
  // leaf is spliced in as a sibling of the target column wherever it sits in the
  // group tree. Every row gets the new key so its cells are addressable at once.
  const insertColumnAt = React.useCallback(
    (columnId: string, side: 'left' | 'right') => {
      const newId = `col_${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 5)}`
      const newCol = makeBlankColumn(newId)
      // Fold computed column values into the rows first (no-op once the schema
      // is already user-owned), then seed the new key on every row. Both are
      // functional so a repeated insert composes instead of clobbering.
      materializeRows()
      setData((prev) =>
        (prev as unknown as Record<string, unknown>[]).map(
          (r) => ({ ...r, [newId]: '' }) as unknown as Person,
        ),
      )

      // Recursively rebuild the tree, inserting `newCol` beside the target leaf.
      editSchema((defs) => {
        let done = false
        const walk = (arr: unknown[]): unknown[] => {
          const out: unknown[] = []
          for (const raw of arr) {
            const def = raw as Record<string, unknown>
            if (!done && Array.isArray(def.columns)) {
              out.push({ ...def, columns: walk(def.columns) })
            } else if (!done && String(def.id ?? def.accessorKey) === columnId) {
              done = true
              if (side === 'left') out.push(newCol, def)
              else out.push(def, newCol)
            } else {
              out.push(def)
            }
          }
          return out
        }
        return walk(defs) as typeof baseColumns
      })
    },
    [editSchema, materializeRows],
  )

  // Remove a column, in ANY schema.
  //
  // This used to filter `customColumns` and nothing else, which made it a silent
  // no-op on every sheet the user had not authored — including the demo the app
  // opens on. Worse, `insertColumnAt` above materialises a built-in schema into
  // `importedColumns`, so inserting a column and then deleting it appeared to do
  // nothing at all: the delete looked in the one place the new column was not.
  // It now takes the same three-way `editSchema` path insert and rename take.
  //
  // The walk recurses so a column nested under a group header is reachable, and
  // a group left with no children goes with it rather than hanging over a gap.
  // The cell VALUES stay in `data` under the dropped key: nothing else reads
  // them, and leaving them there is what lets an undo of the enclosing snapshot
  // put the column back with its contents intact.
  const deleteColumn = React.useCallback(
    (columnId: string) => {
      columnTypeOverrides.clear(columnId)
      materializeRows()
      editSchema((defs) => {
        const walk = (arr: unknown[]): unknown[] => {
          const out: unknown[] = []
          for (const raw of arr) {
            const def = raw as Record<string, unknown>
            if (String(def.id ?? def.accessorKey) === columnId) continue
            if (Array.isArray(def.columns)) {
              const kids = walk(def.columns)
              if (!kids.length) continue
              out.push({ ...def, columns: kids })
            } else {
              out.push(def)
            }
          }
          return out
        }
        return walk(defs) as typeof baseColumns
      })
    },
    [editSchema, materializeRows],
  )

  // ── Find in table (Ctrl+F) ──────────────────────────────────────────────────
  // Every cell whose DISPLAYED text contains the query, over the currently
  // filtered/sorted rows (so it matches what the user sees), across all pages.
  // Attachment columns are skipped (their value has no meaningful text).
  const findMatches = React.useMemo(() => {
    const needle = findText.trim().toLowerCase()
    const out: { rowId: string; columnId: string; pos: number }[] = []
    if (!needle) return out
    const rows = table.getFilteredRowModel().rows
    const leaf = table
      .getVisibleLeafColumns()
      .filter(
        (col) =>
          !SKIP_COLUMNS.includes(col.id) &&
          !isAttachmentType(
            resolveColumnMeta(col.id, col.columnDef.meta as never).type,
          ),
      )
    for (let pos = 0; pos < rows.length; pos++) {
      const row = rows[pos]
      for (const col of leaf) {
        const raw = row.getValue(col.id)
        const meta = resolveColumnMeta(col.id, col.columnDef.meta as never)
        let shown = ''
        try {
          shown = formatCellValue(raw, meta)
        } catch {
          shown = ''
        }
        if (!shown) shown = raw == null ? '' : String(raw)
        if (shown.toLowerCase().includes(needle)) {
          out.push({ rowId: row.id, columnId: col.id, pos })
        }
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findText, data, globalFilter, columnFilters, columns, typeOverridesVersion])

  // A fresh query starts at the first match.
  React.useEffect(() => {
    setFindIndex(0)
  }, [findText])

  const gotoMatch = React.useCallback(
    (dir: 1 | -1) => {
      setFindIndex((i) =>
        findMatches.length ? (i + dir + findMatches.length) % findMatches.length : 0,
      )
    },
    [findMatches.length],
  )
  gotoMatchRef.current = gotoMatch

  const closeFind = React.useCallback(() => {
    setFindBarOpen(false)
    setFindText('')
    setFindIndex(0)
  }, [])

  const onFindInputKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'F3') {
        e.preventDefault()
        gotoMatch(e.shiftKey ? -1 : 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        gotoMatch(-1)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        closeFind()
      }
    },
    [gotoMatch, closeFind],
  )

  // The highlight the cells read (only while the bar is open).
  const findHighlight = React.useMemo<FindHighlight>(() => {
    if (!findBarOpen || !findMatches.length) {
      return { matches: new Set<string>(), current: null }
    }
    const matches = new Set(findMatches.map((m) => findKey(m.rowId, m.columnId)))
    const cur = findMatches[Math.min(findIndex, findMatches.length - 1)]
    return { matches, current: cur ? findKey(cur.rowId, cur.columnId) : null }
  }, [findBarOpen, findMatches, findIndex])

  // Step to a match → jump to its page and scroll the cell into view.
  React.useEffect(() => {
    if (!findBarOpen) return
    const m = findMatches[findIndex]
    if (!m) return
    const state = table.getState().pagination
    const size = state.pageSize || 1
    const page = Math.floor(m.pos / size)
    if (state.pageIndex !== page) table.setPageIndex(page)
    requestAnimationFrame(() => {
      const key = findKey(m.rowId, m.columnId).replace(/"/g, '\\"')
      document
        .querySelector(`[data-find-key="${key}"]`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [findIndex, findBarOpen, findMatches])

  // Surface column-model changes (add / remove / rename / retype / reorder /
  // hide) to a host as a light schema description. Recomputed each render (few
  // columns) and gated on a stable key so the callback only fires on real
  // changes, never on the initial mount.
  const columnInfos: ColumnInfo[] = table
    .getVisibleLeafColumns()
    .filter((col) => !SKIP_COLUMNS.includes(col.id))
    .map((col) => ({
      id: col.id,
      header:
        typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id,
      type: (col.columnDef.meta as { type?: string } | undefined)?.type,
    }))
  const columnInfosRef = React.useRef(columnInfos)
  columnInfosRef.current = columnInfos
  const onColumnChangeRef = React.useRef(onColumnChange)
  onColumnChangeRef.current = onColumnChange
  const columnKey = columnInfos
    .map((c) => `${c.id}:${c.header}:${c.type ?? ''}`)
    .join('|')
  const columnMountedRef = React.useRef(false)
  React.useEffect(() => {
    if (!columnMountedRef.current) {
      columnMountedRef.current = true
      return
    }
    onColumnChangeRef.current?.(columnInfosRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnKey])

  // Columns Find & replace may target (skip / read-only columns excluded from
  // being replaced into).
  const findReplaceColumns = React.useMemo(
    () =>
      table.getAllLeafColumns().map((col) => {
        const header = col.columnDef.header
        return {
          id: col.id,
          label: typeof header === 'string' ? header : col.id,
          readOnly:
            readOnlyColumns.includes(col.id) || SKIP_COLUMNS.includes(col.id),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, readOnlyColumns],
  )

  // ── Sheet switching ────────────────────────────────────────────────────────
  //
  // What "a sheet" is made of, and where each piece lives:
  //
  //   formatting / column types  → module singletons, re-aimed by `useSheet`
  //   merges                     → App state + `tableColumnMerges:<id>`
  //   rows / column defs / formulas → App state + `tt.customSheet.v1:<id>`
  //   layout (order, widths, …)  → App + TanStack state + `tt.sheetView.v1:<id>`
  //   imported clone schema, filters, query, selection → App state ONLY
  //
  // The last line is why there is an in-session stash as well as storage.
  // `importedColumns` is a live TanStack column tree full of render functions —
  // it cannot be JSON — and column filters / the query / the row selection are
  // transient view state that deliberately does NOT persist (restoring a
  // forgotten filter on a later visit is how a user concludes their data is
  // gone). Keeping them in a Map for the life of the page makes a switch-and-back
  // exactly lossless, while a reload still starts those three clean.
  //
  // So hydration has three tiers, most faithful first:
  //   1. the session stash — this page has seen this sheet; restore it verbatim
  //   2. localStorage      — a previous session's bytes
  //   3. a blank sheet     — brand new tab, or a sheet that never saved anything
  type SheetSession = {
    data: Person[]
    formulas: FormulaMap
    customColumns: typeof baseColumns | null
    importedColumns: typeof baseColumns | null
    merges: ColumnMerge[]
    rowHeights: Record<number, number>
    columnOrder: ColumnOrderState
    columnVisibility: Record<string, boolean>
    columnSizing: Record<string, number>
    columnPinning: ColumnPinningState
    rowPinning: RowPinningState
    grouping: GroupingState
    sorting: SortingState
    columnFilters: ColumnFiltersState
    globalFilter: GlobalSearchValue
    pageSize: number
  }
  const sheetStashRef = React.useRef(new Map<string, SheetSession>())

  /** Everything the ACTIVE sheet is showing right now, as one plain object. */
  const captureActiveSheet = React.useCallback((): SheetSession => {
    const state = table.getState()
    return {
      data,
      formulas,
      customColumns,
      importedColumns,
      merges,
      rowHeights,
      columnOrder,
      columnVisibility,
      columnSizing: state.columnSizing,
      columnPinning,
      rowPinning,
      grouping,
      sorting: state.sorting,
      columnFilters,
      globalFilter,
      pageSize: state.pagination.pageSize,
    }
  }, [
    table,
    data,
    formulas,
    customColumns,
    importedColumns,
    merges,
    rowHeights,
    columnOrder,
    columnVisibility,
    columnPinning,
    rowPinning,
    grouping,
    columnFilters,
    globalFilter,
  ])

  /** Push a captured sheet onto the screen. Every field is SET, never merged. */
  const applySheetSession = React.useCallback(
    (session: SheetSession) => {
      setData(session.data)
      setFormulas(session.formulas)
      setCustomColumns(session.customColumns)
      setImportedColumns(session.importedColumns)
      setMerges(session.merges)
      setRowHeights(session.rowHeights)
      setColumnOrder(session.columnOrder)
      setColumnVisibility(session.columnVisibility)
      setColumnPinning(session.columnPinning)
      setRowPinning(session.rowPinning)
      setGrouping(session.grouping)
      setColumnFilters(session.columnFilters)
      setGlobalFilter(session.globalFilter)
      // Sorting, sizing and page size are UNCONTROLLED — TanStack owns them —
      // so they are written through the table, exactly as `importSnapshot` does.
      table.setColumnSizing(session.columnSizing)
      table.setSorting(session.sorting)
      table.setPageSize(session.pageSize)
      // Page 0: the incoming sheet's row count is unrelated to the outgoing
      // one's, and landing on page 7 of a two-page sheet shows an empty grid.
      table.setPageIndex(0)
      // A selection belongs to the sheet it was made on — its row indices mean
      // something else here.
      setRowSelection({})
    },
    [table],
  )

  /**
   * The sheet a tab that has nothing stored opens on: blank, never the demo.
   *
   * The demo data is a SAMPLE the app seeds itself with on a cold start; a new
   * tab the user just asked for is theirs, and handing them 1000 rows of fake
   * people to delete would be actively hostile. Matches `deleteAllTable`.
   */
  const blankSheetSession = React.useCallback((): SheetSession => {
    const cols = blankColumns(6)
    const ids = cols.map((c) => String(c.id))
    return {
      data: blankRows(BLANK_SHEET_ROWS, ids) as unknown as Person[],
      formulas: {},
      customColumns: cols as unknown as typeof baseColumns,
      importedColumns: null,
      merges: [],
      rowHeights: {},
      columnOrder: [],
      columnVisibility: {},
      columnSizing: {},
      columnPinning: {},
      rowPinning: { top: [], bottom: [] },
      grouping: [],
      sorting: [],
      columnFilters: [],
      globalFilter: emptyGlobalSearch,
      pageSize: STANDALONE_PAGE_SIZE,
    }
  }, [])

  /** Tier 2: rebuild a sheet from its stored bytes, filling the rest in blank. */
  const loadSheetSession = React.useCallback(
    (sheetId: string): SheetSession => {
      const base = blankSheetSession()
      const saved = loadCustomSheet(sheetId)
      const view = loadSheetView(sheetId)
      return {
        ...base,
        ...(saved
          ? {
              data: saved.data as unknown as Person[],
              formulas: saved.formulas as FormulaMap,
              customColumns: saved.customColumns as unknown as typeof baseColumns,
            }
          : {}),
        merges: loadStoredMerges(sheetId),
        rowHeights: toNumberMap(view?.rowHeights),
        columnOrder: view?.columnOrder ?? base.columnOrder,
        columnVisibility: view?.columnVisibility ?? base.columnVisibility,
        columnSizing: view?.columnSizing ?? base.columnSizing,
        columnPinning: {
          left: view?.columnPinning?.left ?? [],
          right: view?.columnPinning?.right ?? [],
        },
        rowPinning: {
          top: view?.rowPinning?.top ?? [],
          bottom: view?.rowPinning?.bottom ?? [],
        },
        grouping: view?.grouping ?? base.grouping,
        sorting: view?.sorting ?? base.sorting,
        pageSize: view?.pageSize ?? base.pageSize,
      }
    },
    [blankSheetSession],
  )

  /**
   * Move the app from one sheet to another. The registry is NOT touched here —
   * callers commit it once, so an add or a delete cannot leave storage saying
   * one thing and the singletons another.
   *
   * Order is the whole correctness argument, and it is: capture → flush →
   * re-aim → hydrate.
   *
   *   FLUSH BEFORE RE-AIM. Everything the outgoing sheet owns is written while
   *   the namespace still points at it. The debounced autosave has a 400ms
   *   timer that the state changes below are about to cancel, so without an
   *   explicit flush here the last few hundred milliseconds of typing would be
   *   dropped on every tab click. Each write also names its sheet id outright,
   *   so even a write that somehow arrived late could not land on the wrong key.
   *
   *   The flush deliberately ignores the autosave's `isCustomSchema` gate and
   *   routes through `saveSheetNow` (the Save button's path), which serialises a
   *   demo / profile schema's live column defs into plain JSON. That gate exists
   *   so a BACKGROUND write never quietly adopts the sample data as the user's;
   *   leaving one tab for another is not a background write, it is the user
   *   saying "keep that, I'll be back", and a tab that came back empty because
   *   its schema happened to be the built-in one would be indefensible. This
   *   opens the same one-way door `explicitSheetSave.ts` documents: after a
   *   reload the sheet returns as a `customColumns` sheet rather than re-seeding
   *   the demo. Within a session the stash restores it verbatim, demo and all.
   */
  const moveActiveSheet = React.useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return

      // ── capture ──
      const outgoing = captureActiveSheet()
      sheetStashRef.current.set(fromId, outgoing)

      // ── flush, under the OUTGOING id ──
      saveSheetNow(
        {
          columns: effectiveBaseColumns as unknown as unknown[],
          data: outgoing.data as unknown as unknown[],
          formulas: outgoing.formulas,
        },
        fromId,
      )
      storeMerges(outgoing.merges, fromId)
      saveSheetView(fromId, {
        columnOrder: outgoing.columnOrder,
        columnSizing: outgoing.columnSizing,
        columnVisibility: outgoing.columnVisibility,
        columnPinning: {
          left: outgoing.columnPinning.left ?? [],
          right: outgoing.columnPinning.right ?? [],
        },
        rowPinning: {
          top: (outgoing.rowPinning.top ?? []).map(String),
          bottom: (outgoing.rowPinning.bottom ?? []).map(String),
        },
        sorting: outgoing.sorting.map((s) => ({ id: s.id, desc: !!s.desc })),
        grouping: outgoing.grouping,
        pageSize: outgoing.pageSize,
        rowHeights: outgoing.rowHeights as unknown as Record<string, number>,
      })

      // ── re-aim: formatting, column types, merges, custom sheet ──
      pointStoresAtSheet(toId)

      // ── hydrate ──
      applySheetSession(
        sheetStashRef.current.get(toId) ?? loadSheetSession(toId),
      )

      // The undo stacks are keyed to the ROW INDICES of the sheet being left, so
      // replaying them onto a different sheet's rows would corrupt it. There is
      // no cross-sheet undo, and the delete confirm says so.
      history.clear()
      // Attachments are NOT released: the outgoing sheet's rows are still held
      // in the stash and will be shown again if the user tabs back, and a
      // revoked `blob:` URL is dead for good. They are released on unmount and
      // by Delete-all / Reload, which are the paths that genuinely drop rows.
    },
    [
      captureActiveSheet,
      applySheetSession,
      loadSheetSession,
      effectiveBaseColumns,
      history,
    ],
  )

  /** Persist and adopt a new registry in one step. */
  const commitRegistry = React.useCallback((next: SheetRegistry) => {
    saveSheetRegistry(next)
    setRegistry(next)
  }, [])

  const selectSheet = React.useCallback(
    (id: string) => {
      if (id === registry.activeId) return
      if (!registry.sheets.some((sheet) => sheet.id === id)) return
      moveActiveSheet(registry.activeId, id)
      commitRegistry({ ...registry, activeId: id })
    },
    [registry, moveActiveSheet, commitRegistry],
  )

  const addSheet = React.useCallback(() => {
    const { registry: next, sheet } = withNewSheet(registry)
    // Nothing is stored under a freshly minted id — `nextOrdinal` guarantees it
    // has never been used — so hydration falls to tier 3 and the tab opens blank.
    moveActiveSheet(registry.activeId, sheet.id)
    commitRegistry(next)
  }, [registry, moveActiveSheet, commitRegistry])

  const renameSheet = React.useCallback(
    (id: string, name: string) => {
      commitRegistry(withRenamedSheet(registry, id, name))
    },
    [registry, commitRegistry],
  )

  const deleteSheet = React.useCallback(
    (id: string) => {
      const next = withoutSheet(registry, id)
      // `null` = this is the last sheet. The strip hides its "×" in that case, so
      // reaching here means something else asked; refuse rather than render zero
      // sheets or silently substitute a blank one.
      if (!next) return
      // Leave first if we are standing on it: `moveActiveSheet` flushes the
      // outgoing sheet on the way out, which would resurrect the bytes we are
      // about to erase — hence the erase comes AFTER, not before.
      if (id === registry.activeId) moveActiveSheet(id, next.activeId)
      sheetStashRef.current.delete(id)
      eraseSheetStorage(id)
      commitRegistry(next.registry)
    },
    [registry, moveActiveSheet, commitRegistry],
  )

  // Wipe EVERY sheet and start over with one blank one. The heaviest thing the
  // app can do, so it lives in Settings behind its own confirm rather than in the
  // toolbar next to Delete-all — those are deliberately different actions:
  // Delete-all empties THIS sheet, this empties the whole workbook.
  //
  // Order matters, and it is the reverse of `deleteSheet`'s. There, we switch off
  // a sheet before erasing it because the switch FLUSHES the outgoing sheet and
  // would resurrect the bytes. Here every sheet is going, so there is nothing to
  // switch to and nothing worth flushing: drop the in-memory stash FIRST so no
  // later write can re-persist a dead sheet, then erase every namespace, then
  // point the stores at the fresh sheet, then reset the React state that is still
  // holding the old sheet's rows.
  const resetAllSheets = React.useCallback(() => {
    // Every id in the registry, including the active one.
    for (const sheet of registry.sheets) eraseSheetStorage(sheet.id)
    sheetStashRef.current.clear()
    const fresh = emptySheetRegistry()
    pointStoresAtSheet(fresh.activeId)
    commitRegistry(fresh)
    // Same blank-sheet reset the toolbar's Delete-all performs, applied to what
    // is now the only sheet there is.
    deleteAllTable()
  }, [registry, commitRegistry, deleteAllTable])

  // ── View snapshot: the whole thing (data + non-data view) for export/share ──
  //
  // ACTIVE SHEET ONLY, deliberately. `AppSnapshot` is a versioned format (v2)
  // with share links and .json files already in the wild; teaching it about tabs
  // is a v3 change with its own import/merge questions ("does opening a 3-sheet
  // file replace my 5 sheets?") and is a separate piece of work. Export, share
  // and import therefore all mean "this tab", which is also what the buttons
  // said before tabs existed.
  const buildSnapshot = React.useCallback(
    (): AppSnapshot => ({
      version: 1,
      // Self-contained rows: computed (accessorFn) column values folded in, so an
      // import reproduces every cell — including columns the source derived.
      data: resolveDisplayedData(),
      formulas,
      formatting: tableFormatting.snapshot(),
      columnTypes: columnTypeOverrides.snapshot(),
      query: globalFilter,
      tableState: {
        columnOrder,
        columnSizing: table.getState().columnSizing,
        columnPinning,
        columnVisibility,
        rowPinning,
        // Sort / group / column-filter / selection / page size — the rest of the
        // view state, so the clone shows the same sorted, grouped, filtered,
        // paged and selected picture. `sorting` is uncontrolled, so it is read
        // straight off the table.
        sorting: table.getState().sorting,
        grouping,
        columnFilters,
        rowSelection,
        pagination: { pageSize: table.getState().pagination.pageSize },
      },
      merges,
      // The FULL column tree (groups, headers, types, order, sizes), so an
      // import can rebuild an identical table rather than dropping the data onto
      // the host's own columns. Serialised from the pre-merge base schema —
      // merges are restored separately and re-applied on top.
      columnSchema: serializeColumns(effectiveBaseColumns),
      // Per-row heights, so a resized row clones at the same height.
      ...(Object.keys(rowHeights).length
        ? { rowHeights: rowHeights as Record<string, number> }
        : {}),
      // User-defined formula functions + custom column-type presets the view
      // depends on, so formulas still evaluate and custom units still resolve on
      // another machine.
      customFunctions: customFunctions.toJSON(),
      customColumnTypes: columnTypeRegistry.list().filter((p) => !p.builtin),
      // A wiped-to-blank sheet ships its generic schema so the shared view keeps
      // the user's headers; the built-in schema is left implicit.
      ...(customColumns
        ? { customColumns: customColumns as unknown as unknown[] }
        : {}),
    }),
    [
      data,
      formulas,
      globalFilter,
      columnOrder,
      columnPinning,
      columnVisibility,
      rowPinning,
      grouping,
      columnFilters,
      rowSelection,
      rowHeights,
      merges,
      customColumns,
      effectiveBaseColumns,
      resolveDisplayedData,
      table,
    ],
  )

  const importSnapshot = React.useCallback(
    (s: AppSnapshot) => {
      // Revoke the OLD view's object URLs, but keep any the incoming snapshot
      // already minted (the .zip import rebuilds its media before we get here —
      // a blanket revoke would kill exactly those and break every image).
      releaseAllAttachments(collectAttachmentUrls(s.data ?? []))
      history.clear()
      // Restore the view's own custom functions + column-type presets FIRST, so
      // formula recalculation and column-type resolution below see them. Both
      // merge (non-destructive) rather than replacing the user's local set.
      if (Array.isArray(s.customFunctions) && s.customFunctions.length) {
        const merged = new Map<string, unknown>()
        for (const fn of customFunctions.toJSON()) {
          merged.set(String((fn as { name?: string }).name ?? '').toLowerCase(), fn)
        }
        for (const fn of s.customFunctions) {
          const name = (fn as { name?: unknown }).name
          if (typeof name === 'string' && name.trim()) {
            merged.set(name.toLowerCase(), fn)
          }
        }
        customFunctions.replaceAll([...merged.values()])
      }
      if (Array.isArray(s.customColumnTypes) && s.customColumnTypes.length) {
        columnTypeRegistry.restoreCustoms(s.customColumnTypes)
      }
      setFormulas((s.formulas ?? {}) as FormulaMap)
      setData((s.data ?? []) as unknown as Person[])
      tableFormatting.restore((s.formatting ?? {}) as never)
      columnTypeOverrides.restore((s.columnTypes ?? {}) as never)
      setGlobalFilter((s.query as GlobalSearchValue) ?? emptyGlobalSearch)
      setRowHeights((s.rowHeights ?? {}) as Record<number, number>)
      const ts = (s.tableState ?? {}) as {
        columnOrder?: ColumnOrderState
        columnSizing?: Record<string, number>
        columnPinning?: ColumnPinningState
        columnVisibility?: Record<string, boolean>
        rowPinning?: RowPinningState
        sorting?: SortingState
        grouping?: GroupingState
        columnFilters?: ColumnFiltersState
        rowSelection?: Record<string, boolean>
        pagination?: { pageSize?: number }
      }
      if (ts.columnOrder) setColumnOrder(ts.columnOrder)
      if (ts.columnPinning) setColumnPinning(ts.columnPinning)
      if (ts.columnVisibility) setColumnVisibility(ts.columnVisibility)
      if (ts.rowPinning) setRowPinning(ts.rowPinning)
      if (ts.columnSizing) table.setColumnSizing(ts.columnSizing)
      // Sort / group / filter / selection / paging: always SET (even to empty)
      // so importing a plain view also clears any of these left over from before.
      table.setSorting(ts.sorting ?? [])
      setGrouping(ts.grouping ?? [])
      setColumnFilters(ts.columnFilters ?? [])
      setRowSelection(ts.rowSelection ?? {})
      if (ts.pagination?.pageSize) table.setPageSize(ts.pagination.pageSize)
      setMerges((s.merges ?? []) as ColumnMerge[])
      // The clone: rebuild the exported column tree so the table's structure
      // (groups, headers, types, order) matches the source exactly, regardless
      // of what columns the host started with. Newer exports always carry this.
      const schema = s.columnSchema as ColumnSchemaNode[] | undefined
      setImportedColumns(
        schema && schema.length
          ? (rebuildColumns(schema, selectColumn) as unknown as typeof baseColumns)
          : null,
      )
      // Legacy path: an older export with only a blank-sheet schema and no
      // columnSchema still restores its generic columns.
      setCustomColumns(
        !schema && Array.isArray(s.customColumns) && s.customColumns.length
          ? (s.customColumns as unknown as typeof baseColumns)
          : null,
      )
    },
    [history, table],
  )

  // Restore the ACTIVE sheet's saved layout on a cold load, so a reload lands on
  // the sheet arranged the way the user left it — the same layout a tab switch
  // restores. Without this the two paths disagree: tabbing to a sheet would show
  // your column widths while reloading onto the very same sheet would not.
  //
  // Skipped when a vertical's profile schema is in charge: those columns are
  // composed fresh from the selected profiles, so an order stored against a
  // different selection names columns that are not on screen.
  //
  // Declared BEFORE the shared-view effect below on purpose. Both are mount
  // effects and React runs them in declaration order, so a snapshot arriving in
  // the URL — which carries its own complete `tableState` — lands last and wins.
  React.useEffect(() => {
    if (!standalone || activeVertical) return
    const view = loadSheetView(activeSheetId)
    if (!view) return
    if (view.columnOrder) setColumnOrder(view.columnOrder)
    if (view.columnVisibility) setColumnVisibility(view.columnVisibility)
    if (view.columnSizing) table.setColumnSizing(view.columnSizing)
    if (view.columnPinning) {
      setColumnPinning({
        left: view.columnPinning.left ?? [],
        right: view.columnPinning.right ?? [],
      })
    }
    if (view.rowPinning) {
      setRowPinning({
        top: view.rowPinning.top ?? [],
        bottom: view.rowPinning.bottom ?? [],
      })
    }
    if (view.sorting) table.setSorting(view.sorting)
    if (view.grouping) setGrouping(view.grouping)
    if (view.pageSize) table.setPageSize(view.pageSize)
    if (view.rowHeights) setRowHeights(toNumberMap(view.rowHeights))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Open a shared view file → the URL carries the snapshot; restore it on load.
  // Standalone demo only — a library embed must not read the host page's URL.
  React.useEffect(() => {
    if (!standalone) return
    const shared = readSharedSnapshotFromUrl()
    if (shared) importSnapshot(shared)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A merged-away column keeps its identity in `data` but no longer exists on
  // the table, so every piece of state that pointed at it is dropped rather
  // than left to sort / filter / pin against a column that cannot be resolved.
  React.useEffect(() => {
    const live = collectColumnIds(columns)

    setGrouping((prev) => {
      const next = prev.filter((id) => live.has(id))
      return next.length === prev.length ? prev : next
    })
    setColumnFilters((prev) => {
      const next = prev.filter((filter) => live.has(filter.id))
      return next.length === prev.length ? prev : next
    })
    // A stale id in columnOrder is not fatal - TanStack ignores it - but it
    // would make the drag layer's flat order disagree with the tree.
    setColumnOrder((prev) => {
      const next = prev.filter((id) => live.has(id))
      return next.length === prev.length ? prev : next
    })
    setColumnPinning((prev) => {
      const left = (prev.left ?? []).filter((id) => live.has(id))
      const right = (prev.right ?? []).filter((id) => live.has(id))
      return left.length === (prev.left ?? []).length &&
        right.length === (prev.right ?? []).length
        ? prev
        : { left, right }
    })
    // Sorting is uncontrolled, so it is pruned through the table instance.
    table.setSorting((prev) => {
      const next = prev.filter((sort) => live.has(sort.id))
      return next.length === prev.length ? prev : next
    })
    setGlobalFilter((prev) => {
      const values = prev.values.filter((value) => live.has(value.columnId))
      const scoped = prev.columns.filter((id) => live.has(id))
      return values.length === prev.values.length &&
        scoped.length === prev.columns.length
        ? prev
        : { ...prev, values, columns: scoped }
    })
  }, [columns])

  // Keep every formula cell in sync with its inputs. `recalcFormulas` hands the
  // same array back when nothing changed, so React bails out and this settles
  // after one pass instead of looping.
  React.useEffect(() => {
    if (!Object.keys(formulas).length) return
    setData((old) => {
      const next = recalcFormulas(old, formulas)
      if (next !== old) skipAutoResetPageIndex()
      return next
    })
    // `customFunctionsVersion` is in the deps so that editing or deleting a
    // custom function re-runs every dependent formula.
  }, [data, formulas, customFunctionsVersion])

  React.useEffect(() => {
    if (table.getState().columnFilters[0]?.id === 'fullName') {
      if (table.getState().sorting[0]?.id !== 'fullName') {
        table.setSorting([{ id: 'fullName', desc: false }])
      }
    }
  }, [table.getState().columnFilters[0]?.id])

  return (
    // One viewport: the toolbar keeps its natural height, the table region takes
    // the rest and scrolls on its own (§8 — only the table scrolls, not the page).
    // `.jt-root` + `data-jt="root"` are the stable theming hooks for the whole app.
    <AttachmentConfigProvider config={resolvedAttachmentConfig}>
    <FindHighlightProvider value={findHighlight}>
    <div
      data-jt="root"
      className={`jt-root h-screen w-full max-w-full overflow-hidden box-border p-1.5 sm:p-3 flex flex-col gap-1.5 ${rootPartClass}`}
    >
      {findBarOpen ? (
        <FindBar
          query={findText}
          onQueryChange={setFindText}
          current={findMatches.length ? Math.min(findIndex, findMatches.length - 1) + 1 : 0}
          total={findMatches.length}
          onNext={() => gotoMatch(1)}
          onPrev={() => gotoMatch(-1)}
          onClose={closeFind}
          inputRef={findInputRef}
          onInputKeyDown={onFindInputKeyDown}
        />
      ) : null}
      <div className="table-region min-w-0 flex-1 min-h-0">
        <ThumbnailSizeProvider size={isCustomSchema ? 'S' : thumbnailSize}>
          <CellSelectionProvider
            table={table}
            formulas={formulas}
            setFormulas={setFormulas}
            skipColumns={SKIP_COLUMNS}
            readOnlyColumns={readOnlyColumns}
            history={history}
            onSelectionChange={onSelectionChange}
            onCellActivate={onCellActivate}
            onCellClick={onCellClick}
            onCellKeyDown={onCellKeyDown}
            onColumnHeaderClick={onColumnHeaderClick}
            onRowHeaderClick={onRowHeaderClick}
          >
            <div className="flex h-full flex-col gap-1.5">
              {/* The tab strip, above the toolbar: one 32px row, the same module
                  as every control below it. Standalone, non-vertical only — see
                  the two exclusions on the `registry` state. */}
              {sheetsEnabled ? (
                <SheetTabs
                  sheets={registry.sheets}
                  activeId={registry.activeId}
                  onSelect={selectSheet}
                  onAdd={addSheet}
                  onRename={renameSheet}
                  onDelete={deleteSheet}
                  chromeOpen={chromeOpen}
                  onToggleChrome={toggleChrome}
                />
              ) : null}
              {/* The actions div: the query on the left, the contextual ops rail
                  plus every general action on the right, laid out in ONE
                  adaptive band that wraps onto a second line when it has to.
                  At sm+ there is no expand toggle at all — every action below is
                  on screen. Below sm, where a 375px row cannot hold eleven of
                  them, ActionsRow keeps the first few of ACTION_PRIORITY inline
                  and folds the rest behind one "⋮"; it renders that control only
                  when there is genuinely something behind it. See ActionsRow.
                  ── Why this is a flat list and not nested JSX ─────────────────
                  Ordering used to be implicit in where a control was written:
                  four icons in `peek`, three captioned groups in `children`, and
                  the split decided what you could see at once (which is why
                  Reload and Delete-all could never be on screen together). The
                  order now lives in exactly one place — ACTION_PRIORITY in
                  ActionsRow — and this array only says WHAT each action is. The
                  order of the entries below is therefore irrelevant; they are
                  written in priority order purely so the file reads the way the
                  toolbar looks.
                  An entry whose `node` is null is not applicable right now (no
                  second page ⇒ no pager) and is dropped before ordering. */}
              {chromeOpen || !sheetsEnabled ? (
              <ActionsRow
                className="shrink-0"
                query={
                  <div ref={queryRef}>
                    <GlobalSearch
                      table={table}
                      value={globalFilter}
                      onChange={setGlobalFilter}
                    />
                  </div>
                }
                ops={
                  <div ref={setOpsSlot} className="min-w-0 flex-1 empty:hidden" />
                }
                actions={[
                  // Selection formatting / merge / insert / delete-row-or-column
                  // live entirely in the contextual ops rail above; Clear is the
                  // one selection action that stays a plain toolbar button.
                  { id: 'clear', node: <ClearButton /> },
                  // Save, Reload, Delete-all: the whole-sheet lifecycle cluster,
                  // adjacent on purpose. Emerald / sky / rose keeps them apart at
                  // a glance, and ActionsRow fences Delete with hairlines. Both
                  // destructive ones confirm, with dialogs written to be told
                  // apart — see SheetLifecycleActions.
                  {
                    id: 'save',
                    node: <SaveSheetButton onSave={saveSheetExplicitly} />,
                  },
                  {
                    id: 'reload',
                    node: (
                      <ReloadButton
                        onReload={refreshData}
                        // Only the standalone app keeps a saved copy to lose.
                        clearsSavedSheet={standalone}
                      />
                    ),
                  },
                  {
                    id: 'delete-all',
                    node: <DeleteAllButton onDeleteAll={deleteAllTable} />,
                  },
                  {
                    id: 'find',
                    node: (
                      <button
                        type="button"
                        className="icon-btn-sm border border-amber-200 text-amber-600 sm:hover:bg-amber-50"
                        onClick={() => setFindOpen(true)}
                        title="Find & replace (Ctrl+H)"
                        aria-label="Find and replace"
                      >
                        <Replace size={14} />
                      </button>
                    ),
                  },
                  { id: 'functions', node: <CustomFunctionsDropdown /> },
                  {
                    id: 'settings',
                    node: (
                      <button
                        type="button"
                        className="icon-btn-sm border border-slate-300 text-slate-600 sm:hover:bg-slate-100"
                        onClick={() => setSettingsOpen(true)}
                        title="Settings — profiles, saved queries, export & share"
                        aria-label="Settings"
                      >
                        <Settings size={14} />
                      </button>
                    ),
                  },
                  {
                    id: 'help',
                    node: (
                      <button
                        type="button"
                        className="icon-btn-sm border border-sky-200 text-sky-600 sm:hover:bg-sky-50"
                        onClick={openHelp}
                        title="Keyboard shortcuts (?)"
                        aria-label="Keyboard shortcuts"
                      >
                        <HelpCircle size={14} />
                      </button>
                    ),
                  },
                  {
                    // Only when there is something to page through. A pager
                    // reading "1 / 1" with all four arrows dead is pure noise,
                    // and the rows-per-page box next to it is meaningless while
                    // every row already fits on the one page. It reappears by
                    // itself the moment a filter clears or rows are added and the
                    // count goes above one. (The default page size is also large
                    // enough that a fresh blank sheet is a single page — see
                    // STANDALONE_PAGE_SIZE.)
                    id: 'pagination',
                    node:
                      table.getPageCount() > 1 ? (
                        <ControlGroup label="Pagination" tone="sky">
                          <PaginationControls
                            hasNextPage={table.getCanNextPage()}
                            hasPreviousPage={table.getCanPreviousPage()}
                            nextPage={table.nextPage}
                            pageCount={table.getPageCount()}
                            pageIndex={table.getState().pagination.pageIndex}
                            pageSize={table.getState().pagination.pageSize}
                            previousPage={table.previousPage}
                            setPageIndex={table.setPageIndex}
                            setPageSize={table.setPageSize}
                          />
                        </ControlGroup>
                      ) : null,
                  },
                  {
                    id: 'profiles',
                    node: activeVertical ? (
                      <React.Suspense fallback={null}>
                        <ControlGroup label="Profiles" tone="violet">
                          <TemplateSelector
                            vertical={activeVertical}
                            selectedIds={selectedProfileIds}
                            onChange={setSelectedProfileIds}
                          />
                        </ControlGroup>
                      </React.Suspense>
                    ) : null,
                  },
                ]}
              />
              ) : null}
              <div className="min-h-0 flex-1">
                <CustomTable
                  table={table}
                  opsSlot={opsSlot}
                  onAddRow={addRow}
                  onAddColumn={isCustomSchema ? addColumn : undefined}
                  // Not gated on `isCustomSchema`: renaming works against any
                  // schema now, materialising a built-in one on first edit.
                  onRenameColumn={renameColumn}
                  onPromoteRowToHeader={
                    isCustomSchema ? promoteRowToHeader : undefined
                  }
                  onInsertColumn={insertColumnAt}
                  onInsertRow={insertRow}
                  // Deliberately NOT gated on `isCustomSchema`, for the same
                  // reason insert never was: gating only delete meant the demo
                  // schema let you add columns you could then never remove. Both
                  // sides now materialise the schema on first structural edit.
                  onDeleteColumn={deleteColumn}
                  onDeleteRow={(dataRowIndex) => deleteRows([dataRowIndex])}
                  rowHeights={rowHeights}
                  onRowHeightsChange={setRowHeights}
                  fontSizes={[...FONT_SIZE_OPTIONS]}
                  fontFamilies={[...FONT_FAMILY_OPTIONS]}
                  onMergeColumns={mergeColumns}
                  onReorderRows={reorderRows}
                />
              </div>
              {/* Excel-style aggregates of the current selection. */}
              <StatsBar table={table} />
            </div>
          </CellSelectionProvider>
        </ThumbnailSizeProvider>
      </div>

      <FindReplaceDialog
        open={findOpen}
        onClose={() => setFindOpen(false)}
        rows={data}
        columns={findReplaceColumns}
        onApply={(updates) => tableMeta.updateCells(updates)}
      />

      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        buildSnapshot={buildSnapshot}
        onImportSnapshot={importSnapshot}
        exportEmbedLimit={exportEmbedLimit}
        currentQuery={globalFilter}
        onLoadQuery={(value) => {
          setGlobalFilter(value as GlobalSearchValue)
          setSettingsOpen(false)
        }}
        // Only where sheets exist. A library embed and a profile vertical both
        // run on the single fixed namespace and have no workbook to reset, so
        // they get no Danger zone tab rather than one that lies about scope.
        onResetAllSheets={sheetsEnabled ? resetAllSheets : undefined}
        sheetCount={registry.sheets.length}
      />
    </div>
    </FindHighlightProvider>
    </AttachmentConfigProvider>
  )
}

export default App
