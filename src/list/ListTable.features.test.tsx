import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { ListTable } from './ListTable'

type Order = { id: string; customer: string; note: string; status: string }

const orders: Order[] = [
  { id: 'o1', customer: 'Charlie', note: 'A very long delivery note that will not fit', status: 'paid' },
  { id: 'o2', customer: 'Alice', note: 'Short', status: 'pending' },
  { id: 'o3', customer: 'Bob', note: 'Leave at the gate', status: 'paid' },
]

const columns: ColumnDef<Order, any>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'note', header: 'Note' },
  { accessorKey: 'status', header: 'Status' },
]

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')

describe('ListTable — per-row props', () => {
  it('spreads getRowProps onto each row and keeps data-row-id', () => {
    render(
      <ListTable
        columns={columns}
        data={orders}
        getRowId={(row) => row.id}
        getRowProps={(row) => ({
          'data-testid': `order-${row.id}`,
          'data-status': row.status,
          'data-row-id': 'ignored',
          className: row.status === 'paid' ? 'is-paid' : undefined,
        })}
      />,
    )
    const row = screen.getByTestId('order-o3')
    expect(row.getAttribute('data-status')).toBe('paid')
    expect(row.getAttribute('data-row-id')).toBe('o3')
    expect(row.classList.contains('is-paid')).toBe(true)
    expect(row.classList.contains('jtl-row')).toBe(true)
    expect(screen.getByTestId('order-o2').classList.contains('is-paid')).toBe(false)
  })
})

describe('ListTable — expandable rows', () => {
  const details = (row: Order) => <p>Details for {row.customer}</p>

  it('toggles a detail row from the built-in button without a row click', () => {
    const onRowClick = vi.fn()
    render(<ListTable columns={columns} data={orders} renderExpanded={details} onRowClick={onRowClick} />)
    expect(screen.queryByText('Details for Alice')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand row' })[1])
    expect(screen.getByText('Details for Alice')).toBeTruthy()
    expect(onRowClick).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse row' }))
    expect(screen.queryByText('Details for Alice')).toBeNull()
  })

  it('takes controlled expanded state and reports changes', () => {
    const onExpandedChange = vi.fn()
    render(
      <ListTable
        columns={columns}
        data={orders}
        getRowId={(row) => row.id}
        renderExpanded={details}
        expanded={{ o2: true }}
        onExpandedChange={onExpandedChange}
      />,
    )
    expect(screen.getByText('Details for Alice')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: 'Expand row' })[0])
    expect(onExpandedChange).toHaveBeenCalledWith({ o2: true, o1: true })
    expect(screen.queryByText('Details for Charlie')).toBeNull()
  })

  it('lets a custom cell toggle through the row API', () => {
    const withToggle: ColumnDef<Order, any>[] = [
      ...columns,
      { id: 'more', header: '', cell: ({ row }) => <button type="button" onClick={() => row.toggleExpanded()}>More</button> },
    ]
    render(<ListTable columns={withToggle} data={orders} renderExpanded={details} showExpandColumn={false} />)
    expect(screen.queryByRole('button', { name: 'Expand row' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'More' })[2])
    expect(screen.getByText('Details for Bob')).toBeTruthy()
  })
})

describe('ListTable — theming and scoping', () => {
  it('uses only jtl- prefixed classes of its own', () => {
    const { container } = render(<ListTable columns={columns} data={orders} getRowHref={(row) => `/o/${row.id}`} renderExpanded={() => 'x'} />)
    const tokens = [...container.querySelectorAll('[class]')].flatMap((node) => [...node.classList])
    expect(tokens.length).toBeGreaterThan(20)
    expect(tokens.filter((token) => !token.startsWith('jtl-'))).toEqual([])
  })

  it('exposes a theme hook on the root', () => {
    const { container, rerender } = render(<ListTable columns={columns} data={orders} theme="dark" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.classList.contains('jtl-root')).toBe(true)
    expect(root.getAttribute('data-theme')).toBe('dark')
    rerender(<ListTable columns={columns} data={orders} />)
    expect(root.hasAttribute('data-theme')).toBe(false)
  })
})

describe('ListTable — labels and visibility', () => {
  it('takes search label, placeholder and pager labels', () => {
    render(
      <ListTable
        columns={columns}
        data={orders}
        pageSize={2}
        searchLabel="Buscar"
        searchPlaceholder="Buscar pedidos"
        labels={{
          nextPage: 'Siguiente',
          previousPage: 'Anterior',
          rowsPerPage: 'Filas',
          range: (from, to, total) => `${from}-${to} de ${total}`,
          page: (page, count) => `Página ${page} de ${count}`,
        }}
      />,
    )
    const search = screen.getByRole('searchbox', { name: 'Buscar' })
    expect(search.getAttribute('placeholder')).toBe('Buscar pedidos')
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeTruthy()
    expect(screen.getByText('1-2 de 3')).toBeTruthy()
    expect(screen.getByText('Página 1 de 2')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Filas' })).toBeTruthy()
  })

  it('hides the toolbar and the pager on request', () => {
    render(<ListTable columns={columns} data={orders} hideToolbar hidePagination />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    expect(bodyRows()).toHaveLength(3)
  })

  it('auto-hides the pager only when everything fits on one page', () => {
    const fits = render(<ListTable columns={columns} data={orders} pageSize={5} hidePagination="auto" />)
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull()
    fits.unmount()
    render(<ListTable columns={columns} data={orders} pageSize={2} hidePagination="auto" />)
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeTruthy()
  })
})

describe('ListTable — cell overflow', () => {
  it('truncates with a tooltip by default and wraps when meta.wrap is set', () => {
    const wrapped: ColumnDef<Order, any>[] = [columns[0], { ...columns[1], meta: { wrap: true } }, columns[2]]
    const { rerender } = render(<ListTable columns={columns} data={orders} />)
    const note = within(bodyRows()[0]).getByText(orders[0].note)
    expect(note.classList.contains('jtl-cell')).toBe(true)
    expect(note.classList.contains('jtl-cell--wrap')).toBe(false)
    expect(note.getAttribute('title')).toBe(orders[0].note)
    rerender(<ListTable columns={wrapped} data={orders} />)
    const wrappedNote = within(bodyRows()[0]).getByText(orders[0].note)
    expect(wrappedNote.classList.contains('jtl-cell--wrap')).toBe(true)
    expect(wrappedNote.hasAttribute('title')).toBe(false)
  })
})
