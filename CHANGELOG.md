# Changelog

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
