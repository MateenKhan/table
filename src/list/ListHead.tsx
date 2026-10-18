import { flexRender, type Header, type Table } from '@tanstack/react-table'
import { Icon } from './icons'
import { cx } from './classNames'
import { FilterInput } from './FilterInput'
import { alignClass, pinEdgeClass, pinStyle } from './pinStyle'

type Props<TData> = {
  table: Table<TData>
  showFilters: boolean
  filterDelay: number
}

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const

export const headerLabel = <TData,>(header: Header<TData, unknown>) => {
  const def = header.column.columnDef.header
  return typeof def === 'string' && def ? def : header.column.id
}

function SortIcon({ dir }: { dir: false | 'asc' | 'desc' }) {
  if (dir === 'asc') return <Icon name="arrowUp" size={12} />
  if (dir === 'desc') return <Icon name="arrowDown" size={12} />
  return <Icon name="sortable" size={12} className="jtl-sort-idle" />
}

function HeadCell<TData>({ header }: { header: Header<TData, unknown> }) {
  const { column } = header
  const leaf = header.subHeaders.length === 0
  const sorted = column.getIsSorted()
  const content = header.isPlaceholder ? null : flexRender(column.columnDef.header, header.getContext())
  return (
    <th
      colSpan={header.colSpan}
      scope="col"
      aria-sort={leaf && sorted ? ARIA_SORT[sorted] : undefined}
      style={{ width: header.getSize(), ...(leaf ? pinStyle(column) : undefined) }}
      className={cx('jtl-th', alignClass(column), leaf && pinEdgeClass(column))}
    >
      {leaf && column.getCanSort() && !header.isPlaceholder ? (
        <button type="button" onClick={column.getToggleSortingHandler()} className="jtl-sort">
          <span className="jtl-truncate">{content}</span>
          <SortIcon dir={sorted} />
        </button>
      ) : (
        content
      )}
      {leaf && column.getCanResize() ? (
        <div
          aria-hidden="true"
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
          onDoubleClick={() => column.resetSize()}
          className={cx('jtl-resizer', column.getIsResizing() && 'jtl-resizer--active')}
        />
      ) : null}
    </th>
  )
}

export function ListHead<TData>({ table, showFilters, filterDelay }: Props<TData>) {
  const groups = table.getHeaderGroups()
  const leafHeaders = groups[groups.length - 1]?.headers ?? []
  return (
    <thead className="jtl-head">
      {groups.map((group) => (
        <tr key={group.id}>
          {group.headers.map((header) => (
            <HeadCell key={header.id} header={header} />
          ))}
        </tr>
      ))}
      {showFilters ? (
        <tr>
          {leafHeaders.map((header) => (
            <th
              key={header.id}
              style={pinStyle(header.column)}
              className={cx('jtl-th', 'jtl-th--filter', pinEdgeClass(header.column))}
            >
              {header.column.getCanFilter() ? (
                <FilterInput column={header.column} label={headerLabel(header)} delay={filterDelay} />
              ) : null}
            </th>
          ))}
        </tr>
      ) : null}
    </thead>
  )
}
