# Changelog

## 0.3.0 — 2026-10-18

### Added
- Shift + mouse wheel scrolls `ListTable` and `SpreadsheetTable` sideways
  inside the table. At either edge the wheel goes to the page. The list's
  horizontal scrollbar is always drawn. `useHorizontalWheel` is exported.
- `ListTable` column formats: a Format choice per column in the columns menu
  (date patterns with `dd-MMM-yyyy` as the default and relative; number
  decimals, grouping, Indian lakh grouping and percent; currency with
  `minorUnits`; text truncate or wrap). Also `meta.format`, `dateFormat`,
  `locale`, `columnFormats` / `onColumnFormatsChange`, `columnVisibility` /
  `onColumnVisibilityChange`, `storageKey` (keeps both in `localStorage`),
  `exportFormatted`, and the `formatValue` helper. Sorting, search and filters
  use raw values. Formatting is done with `Intl` only, so no new dependency.
- `SpreadsheetTable`: `dateFormat` (default for date columns),
  `columnFormats` / `onColumnFormatsChange` (controlled per-column formats,
  reporting the user's number-format choices).

### Changed
- Date columns in `ListTable` now show `dd-MMM-yyyy` unless told otherwise.
- The spreadsheet grid lets horizontal overscroll reach the page.

## 0.2.0 — 2026-10-16

### Added
- `ListTable`: `getRowProps` (row `className`, `style`, `data-testid`, `data-*`;
  `data-row-id` is kept), expandable rows (`renderExpanded`, `expanded` /
  `onExpandedChange`, `getRowCanExpand`, `showExpandColumn`, or
  `row.toggleExpanded()` from a cell), `searchLabel`, translatable `labels`
  (`DEFAULT_LABELS`), `hideToolbar`, `hidePagination` (`true` or `'auto'`),
  `theme`, and column `meta.wrap`.
- Long cell text is cut with an ellipsis, and the full text shows as a tooltip.
- Dark mode for the list: `prefers-color-scheme`, `theme="dark"`,
  `data-theme="dark"` or a `.jtl-dark` ancestor, all through `--jtl-*` CSS
  variables.
- 44px hit areas for list buttons, inputs and the pager on touch screens.

### Changed
- `list.css` is plain CSS with every class prefixed `jtl-`; it no longer ships
  Tailwind utilities. `style.css` now includes the list styles too.
- The list draws its own icons, so it does not need `lucide-react`.
- **package.json:** `dependencies` is only `@tanstack/react-table`. The
  spreadsheet's libraries (`@tanstack/match-sorter-utils`, `date-fns`,
  `framer-motion`, `lucide-react`, `lz-string`, `react-colorful`,
  `react-day-picker`, `react-dropzone`) are optional `peerDependencies`;
  `SpreadsheetTable` users install them. `fflate` is bundled into `table.js`,
  so it moved to `devDependencies`.

## 0.1.0 — 2026-10-16

### Added
- `ListTable` and a lean `@jugaaadi/table/list` entry (with `@jugaaadi/table/list.css`):
  a read-only list with search, sorting, column filters, pagination, column
  show/hide/resize/pin and CSV export, about 13 KB minified instead of ~330 KB.
- Server-side mode for `ListTable`: `manual`, `rowCount`, controlled or
  uncontrolled `pagination`, `sorting`, `globalFilter`, `columnFilters` with
  `on…Change` callbacks (debounced search and filters), `loading`,
  `emptyMessage`.
- Row interaction: `onRowClick`, `getRowHref` (a real link per row; middle and
  modified clicks open a new tab), `getRowId`. Clicks on buttons, links and
  inputs inside custom cell renderers do not trigger `onRowClick`.
- Phone widths: the list scrolls sideways inside its own box and the first
  column stays pinned.
- `SpreadsheetTable` `readOnly` prop and per-column `meta.readOnly`.
- `npm test` (vitest + testing-library) and a GitHub Actions workflow that
  publishes to npm when a `v*` tag is pushed.

### Changed
- The library build has two entries: `dist/table.js` and `dist/list.js`.
  Package types now point at `dist/table.d.ts` / `dist/list.d.ts`.
