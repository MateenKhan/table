import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { ListTable } from './ListTable'
import { toCsv } from './csv'

type Payment = { ref: string; paidAt: string; amount: number; share: number }

const payments: Payment[] = [
  { ref: 'P-2', paidAt: '2026-10-18', amount: 123450, share: 0.25 },
  { ref: 'P-1', paidAt: '2025-02-03', amount: 99, share: 0.5 },
]

const columns: ColumnDef<Payment, any>[] = [
  { accessorKey: 'ref', header: 'Ref' },
  { accessorKey: 'paidAt', header: 'Paid' },
  { accessorKey: 'amount', header: 'Amount', meta: { format: { kind: 'currency', currency: 'USD', minorUnits: true } } },
  { accessorKey: 'share', header: 'Share' },
]

const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]).getAllByRole('row')
const column = (index: number) => bodyRows().map((row) => within(row).getAllByRole('cell')[index].textContent)
const openColumns = () => fireEvent.click(screen.getByLabelText('Columns'))
const formatPicker = (name: string) => screen.getByRole('combobox', { name: `Format ${name}` }) as HTMLSelectElement

describe('ListTable — column formats', () => {
  it('formats dates as dd-MMM-yyyy by default and honours the table date format', () => {
    const { unmount } = render(<ListTable columns={columns} data={payments} locale="en-US" />)
    expect(column(1)).toEqual(['18-Oct-2026', '03-Feb-2025'])
    unmount()
    render(<ListTable columns={columns} data={payments} locale="en-US" dateFormat="dd/MM/yyyy" />)
    expect(column(1)).toEqual(['18/10/2026', '03/02/2025'])
  })

  it('applies developer defaults from meta.format and leaves plain numbers raw', () => {
    render(<ListTable columns={columns} data={payments} locale="en-US" />)
    expect(column(2)).toEqual(['$1,234.50', '$0.99'])
    expect(column(3)).toEqual(['0.25', '0.5'])
  })

  it('lets the user pick a format per column and reports it', () => {
    const onColumnFormatsChange = vi.fn()
    render(<ListTable columns={columns} data={payments} locale="en-US" onColumnFormatsChange={onColumnFormatsChange} />)
    openColumns()
    const date = formatPicker('Paid')
    fireEvent.change(date, { target: { value: 'yyyy-MM-dd' } })
    expect(column(1)).toEqual(['2026-10-18', '2025-02-03'])
    expect(onColumnFormatsChange).toHaveBeenLastCalledWith({ paidAt: { kind: 'date', pattern: 'yyyy-MM-dd' } })
    const share = formatPicker('Share')
    const percent = [...share.options].find((option) => option.textContent === '25%')
    expect(percent).toBeTruthy()
    fireEvent.change(share, { target: { value: percent!.value } })
    expect(column(3)).toEqual(['25%', '50%'])
    const amount = formatPicker('Amount')
    const indian = [...amount.options].find((option) => option.textContent === '$12,34,567.89')
    expect(indian).toBeTruthy()
    fireEvent.change(amount, { target: { value: indian!.value } })
    expect(onColumnFormatsChange.mock.lastCall![0].amount).toEqual({ kind: 'currency', currency: 'USD', minorUnits: true, grouping: 'indian' })
    fireEvent.change(amount, { target: { value: '' } })
    expect(onColumnFormatsChange.mock.lastCall![0].amount).toBeUndefined()
  })

  it('takes controlled formats', () => {
    render(
      <ListTable
        columns={columns}
        data={payments}
        locale="en-US"
        columnFormats={{ paidAt: { kind: 'date', pattern: 'dd-MMM-yyyy HH:mm' }, share: { kind: 'percent', decimals: 1 } }}
      />,
    )
    expect(column(1)).toEqual(['18-Oct-2026 00:00', '03-Feb-2025 00:00'])
    expect(column(3)).toEqual(['25.0%', '50.0%'])
  })

  it('switches text between truncate and wrap', () => {
    render(<ListTable columns={columns} data={payments} locale="en-US" />)
    openColumns()
    fireEvent.change(formatPicker('Ref'), { target: { value: 'wrap' } })
    expect(within(bodyRows()[0]).getByText('P-2').classList.contains('jtl-cell--wrap')).toBe(true)
  })

  it('sorts on raw values, not on the formatted text', () => {
    const data = [
      { ref: 'a', paidAt: '2026-01-20', amount: 1, share: 0 },
      { ref: 'b', paidAt: '2026-02-03', amount: 1, share: 0 },
    ]
    render(<ListTable columns={columns} data={data} locale="en-US" />)
    fireEvent.click(screen.getByRole('button', { name: 'Paid' }))
    expect(column(1)).toEqual(['20-Jan-2026', '03-Feb-2026'])
  })

  it('remembers visibility and formats under storageKey', () => {
    localStorage.clear()
    const first = render(<ListTable columns={columns} data={payments} locale="en-US" storageKey="payments" />)
    openColumns()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Share' }))
    fireEvent.change(formatPicker('Paid'), { target: { value: 'dd/MM/yyyy' } })
    first.unmount()
    render(<ListTable columns={columns} data={payments} locale="en-US" storageKey="payments" />)
    expect(screen.queryByRole('columnheader', { name: 'Share' })).toBeNull()
    expect(column(1)).toEqual(['18/10/2026', '03/02/2025'])
  })

  it('reports column visibility for apps that store it themselves', () => {
    const onColumnVisibilityChange = vi.fn()
    render(<ListTable columns={columns} data={payments} columnVisibility={{ ref: false }} onColumnVisibilityChange={onColumnVisibilityChange} />)
    expect(screen.queryByRole('columnheader', { name: 'Ref' })).toBeNull()
    openColumns()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Share' }))
    expect(onColumnVisibilityChange).toHaveBeenCalledWith({ ref: false, share: false })
  })
})

describe('CSV export', () => {
  it('exports raw values by default and formatted values on request', () => {
    let table: Parameters<typeof toCsv>[0] | undefined
    const grab: ColumnDef<Payment, any>[] = [
      ...columns,
      { id: 'probe', header: 'probe', cell: ({ table: t }) => ((table = t as never), null) },
    ]
    render(<ListTable columns={grab} data={payments} locale="en-US" />)
    expect(toCsv(table!).split('\r\n')[1]).toBe('P-2,2026-10-18,123450,0.25')
    expect(toCsv(table!, true).split('\r\n')[1]).toBe('P-2,18-Oct-2026,"$1,234.50",0.25')
  })
})
