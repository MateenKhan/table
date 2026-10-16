import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { ListTable } from './ListTable'

type Order = { id: string; customer: string; total: number; status: string }

const orders: Order[] = [
  { id: 'o1', customer: 'Charlie', total: 30, status: 'paid' },
  { id: 'o2', customer: 'Alice', total: 10, status: 'pending' },
  { id: 'o3', customer: 'Bob', total: 20, status: 'paid' },
]

const columns: ColumnDef<Order, any>[] = [
  { accessorKey: 'customer', header: 'Customer' },
  { accessorKey: 'total', header: 'Total', meta: { align: 'right' } },
  { accessorKey: 'status', header: 'Status' },
]

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
const customers = () => bodyRows().map((row) => within(row).getAllByRole('cell')[0].textContent)
const sortButton = (name: string) => screen.getByRole('button', { name })

describe('ListTable — client mode', () => {
  it('sorts locally when a header is clicked', () => {
    render(<ListTable columns={columns} data={orders} />)
    expect(customers()).toEqual(['Charlie', 'Alice', 'Bob'])
    fireEvent.click(sortButton('Customer'))
    expect(customers()).toEqual(['Alice', 'Bob', 'Charlie'])
    expect(screen.getByRole('columnheader', { name: 'Customer' }).getAttribute('aria-sort')).toBe('ascending')
  })

  it('searches locally after the debounce', () => {
    vi.useFakeTimers()
    try {
      render(<ListTable columns={columns} data={orders} searchDebounceMs={200} />)
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'bo' } })
      expect(customers()).toHaveLength(3)
      act(() => vi.advanceTimersByTime(200))
      expect(customers()).toEqual(['Bob'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('pages locally by pageSize', () => {
    render(<ListTable columns={columns} data={orders} pageSize={2} pageSizeOptions={[2, 5]} />)
    expect(customers()).toEqual(['Charlie', 'Alice'])
    expect(screen.getByText('1–2 of 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(customers()).toEqual(['Bob'])
  })

  it('pins the first column so it stays visible on a narrow screen', () => {
    render(<ListTable columns={columns} data={orders} />)
    const first = screen.getByRole('columnheader', { name: 'Customer' })
    const second = screen.getByRole('columnheader', { name: 'Total' })
    expect(first.style.position).toBe('sticky')
    expect(first.style.left).toBe('0px')
    expect(second.style.position).toBe('')
    expect(within(bodyRows()[0]).getAllByRole('cell')[0].style.position).toBe('sticky')
  })

  it('shows the empty message and the loading state', () => {
    const { rerender } = render(<ListTable columns={columns} data={[]} emptyMessage="No orders yet" />)
    expect(screen.getByText('No orders yet')).toBeTruthy()
    rerender(<ListTable columns={columns} data={[]} loading emptyMessage="No orders yet" />)
    expect(screen.queryByText('No orders yet')).toBeNull()
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0)
    expect(screen.getByRole('table').getAttribute('aria-busy')).toBe('true')
  })

  it('renders no editors in cells', () => {
    render(<ListTable columns={columns} data={orders} />)
    for (const row of bodyRows()) {
      expect(within(row).queryAllByRole('textbox')).toHaveLength(0)
    }
  })
})

describe('ListTable — rows', () => {
  it('calls onRowClick with the row and its data index, and uses getRowId', () => {
    const onRowClick = vi.fn()
    render(<ListTable columns={columns} data={orders} getRowId={(row) => row.id} onRowClick={onRowClick} />)
    fireEvent.click(sortButton('Customer'))
    const bob = bodyRows()[1]
    expect(bob.getAttribute('data-row-id')).toBe('o3')
    fireEvent.click(within(bob).getByText('20'))
    expect(onRowClick).toHaveBeenCalledTimes(1)
    expect(onRowClick.mock.calls[0][0]).toBe(orders[2])
    expect(onRowClick.mock.calls[0][1]).toBe(2)
  })

  it('lets a cell renderer button work without triggering onRowClick', () => {
    const onRowClick = vi.fn()
    const onRefund = vi.fn()
    const withAction: ColumnDef<Order, any>[] = [
      ...columns,
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <button type="button" onClick={() => onRefund(row.original.id)}>
            Refund
          </button>
        ),
      },
    ]
    render(<ListTable columns={withAction} data={orders} onRowClick={onRowClick} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'Refund' })[0])
    expect(onRefund).toHaveBeenCalledWith('o1')
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('renders a real link per row from getRowHref', () => {
    render(<ListTable columns={columns} data={orders} getRowHref={(row) => `/orders/${row.id}`} />)
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/orders/o1', '/orders/o2', '/orders/o3'])
    expect(links[0].textContent).toBe('Charlie')
  })

  it('routes a plain link click through onRowClick and leaves modified clicks to the browser', () => {
    const onRowClick = vi.fn()
    render(<ListTable columns={columns} data={orders} onRowClick={onRowClick} getRowHref={(row) => `/orders/${row.id}`} />)
    const link = screen.getAllByRole('link')[1]
    const plain = fireEvent.click(link)
    expect(plain).toBe(false)
    expect(onRowClick).toHaveBeenCalledWith(orders[1], 1, expect.anything())
    let leftToBrowser = false
    const observe = (event: Event) => {
      leftToBrowser = !event.defaultPrevented
      event.preventDefault()
    }
    document.addEventListener('click', observe)
    fireEvent.click(link, { ctrlKey: true })
    document.removeEventListener('click', observe)
    expect(leftToBrowser).toBe(true)
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })

  it('opens the row href in a new tab on a middle click anywhere in the row', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    render(<ListTable columns={columns} data={orders} getRowHref={(row) => `/orders/${row.id}`} />)
    fireEvent(within(bodyRows()[2]).getByText('paid'), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    expect(open).toHaveBeenCalledWith('/orders/o3', '_blank', 'noopener')
  })

  it('activates a focusable row with Enter when there is no href', () => {
    const onRowClick = vi.fn()
    render(<ListTable columns={columns} data={orders} onRowClick={onRowClick} />)
    const row = bodyRows()[0]
    expect(row.tabIndex).toBe(0)
    fireEvent.keyDown(row, { key: 'Enter' })
    expect(onRowClick).toHaveBeenCalledWith(orders[0], 0, expect.anything())
  })
})

describe('ListTable — server mode', () => {
  const page = [orders[0], orders[1], orders[2]]

  it('never sorts, filters or pages locally', () => {
    vi.useFakeTimers()
    try {
      const onSortingChange = vi.fn()
      const onGlobalFilterChange = vi.fn()
      render(
        <ListTable
          manual
          columns={columns}
          data={page}
          rowCount={95}
          pagination={{ pageIndex: 0, pageSize: 2 }}
          onSortingChange={onSortingChange}
          onGlobalFilterChange={onGlobalFilterChange}
          searchDebounceMs={100}
        />,
      )
      expect(customers()).toEqual(['Charlie', 'Alice', 'Bob'])
      fireEvent.click(sortButton('Customer'))
      expect(onSortingChange).toHaveBeenCalledWith([{ id: 'customer', desc: false }])
      expect(customers()).toEqual(['Charlie', 'Alice', 'Bob'])
      fireEvent.change(screen.getByRole('searchbox', { name: 'Search' }), { target: { value: 'zzz' } })
      act(() => vi.advanceTimersByTime(100))
      expect(onGlobalFilterChange).toHaveBeenCalledWith('zzz')
      expect(customers()).toEqual(['Charlie', 'Alice', 'Bob'])
    } finally {
      vi.useRealTimers()
    }
  })

  it('takes the page count from rowCount and reports page changes', () => {
    const onPaginationChange = vi.fn()
    render(
      <ListTable
        manual
        columns={columns}
        data={page}
        rowCount={95}
        pagination={{ pageIndex: 0, pageSize: 10 }}
        onPaginationChange={onPaginationChange}
      />,
    )
    expect(screen.getByText('1 / 10')).toBeTruthy()
    expect(screen.getByText('1–10 of 95')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPaginationChange).toHaveBeenLastCalledWith({ pageIndex: 1, pageSize: 10 })
    fireEvent.click(screen.getByRole('button', { name: 'Last page' }))
    expect(onPaginationChange).toHaveBeenLastCalledWith({ pageIndex: 9, pageSize: 10 })
  })

  it('goes back to the first page when the query changes', () => {
    vi.useFakeTimers()
    try {
      const onPaginationChange = vi.fn()
      const onColumnFiltersChange = vi.fn()
      render(
        <ListTable
          manual
          columns={columns}
          data={page}
          rowCount={95}
          pagination={{ pageIndex: 3, pageSize: 10 }}
          onPaginationChange={onPaginationChange}
          onColumnFiltersChange={onColumnFiltersChange}
          searchDebounceMs={50}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Column filters' }))
      fireEvent.change(screen.getByRole('searchbox', { name: 'Filter Status' }), { target: { value: 'paid' } })
      act(() => vi.advanceTimersByTime(50))
      expect(onColumnFiltersChange).toHaveBeenCalledWith([{ id: 'status', value: 'paid' }])
      expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 })
    } finally {
      vi.useRealTimers()
    }
  })

  it('works uncontrolled, keeping its own page state', () => {
    const onPaginationChange = vi.fn()
    render(<ListTable manual columns={columns} data={page} rowCount={30} pageSize={10} onPaginationChange={onPaginationChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 })
    expect(screen.getByText('2 / 3')).toBeTruthy()
  })
})
