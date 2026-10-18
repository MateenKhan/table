import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { SpreadsheetTable, type ColumnDef } from './lib'
import { columnTypeOverrides } from './columnTypeOverrides'
import { fakeScroller, wheel } from './test/scroller'

type Row = Record<string, unknown>

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'joined', header: 'Joined', meta: { type: 'date' } },
  { accessorKey: 'salary', header: 'Salary', meta: { type: 'number', decimals: 0 } },
]
const data = [{ name: 'Ada', joined: '2026-10-18', salary: 1234567 }]

describe('SpreadsheetTable — horizontal wheel', () => {
  it('scrolls its grid sideways on Shift + wheel and lets go at the edge', () => {
    const { container } = render(<SpreadsheetTable columns={columns} data={data} />)
    const grid = container.querySelector('[data-row-drag-scroll]') as HTMLElement
    fakeScroller(grid, 2000, 500)
    expect(wheel(grid, { deltaY: 100, shiftKey: true }).defaultPrevented).toBe(true)
    expect(grid.scrollLeft).toBe(100)
    fakeScroller(grid, 2000, 500, 1500)
    expect(wheel(grid, { deltaY: 100, shiftKey: true }).defaultPrevented).toBe(false)
  })
})

describe('SpreadsheetTable — column formats', () => {
  it('uses the table-wide date format for date columns without their own', () => {
    render(<SpreadsheetTable columns={columns} data={data} dateFormat="dd-MMM-yyyy" />)
    expect(screen.getByDisplayValue('18-Oct-2026')).toBeTruthy()
  })

  it('applies controlled formats and reports the user’s choices', () => {
    const onColumnFormatsChange = vi.fn()
    const { rerender } = render(
      <SpreadsheetTable
        columns={columns}
        data={data}
        columnFormats={{ salary: { locale: 'en-IN' } }}
        onColumnFormatsChange={onColumnFormatsChange}
      />,
    )
    expect(screen.getByDisplayValue('12,34,567')).toBeTruthy()
    act(() => columnTypeOverrides.set('salary', { decimals: 2 }))
    expect(onColumnFormatsChange).toHaveBeenLastCalledWith({ salary: { decimals: 2 } })
    rerender(
      <SpreadsheetTable columns={columns} data={data} columnFormats={{}} onColumnFormatsChange={onColumnFormatsChange} />,
    )
    expect(screen.getByDisplayValue('1,234,567')).toBeTruthy()
  })
})
