import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SpreadsheetTable, type ColumnDef } from './lib'

type Row = Record<string, unknown>

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'city', header: 'City' },
]
const data = [
  { name: 'Ada', city: 'London' },
  { name: 'Alan', city: 'Wilmslow' },
]

const cellOf = (value: string) => screen.getByDisplayValue(value).closest('td') as HTMLElement

function tryToEdit(value: string, next: string) {
  const cell = cellOf(value)
  fireEvent.mouseDown(cell)
  fireEvent.doubleClick(cell)
  const input = screen.getByDisplayValue(value) as HTMLInputElement
  if (!input.readOnly) fireEvent.change(input, { target: { value: next } })
  fireEvent.keyDown(input, { key: 'Enter' })
}

function tryToClear(value: string) {
  fireEvent.mouseDown(cellOf(value))
  fireEvent.keyDown(window, { key: 'Delete' })
}

const button = (name: string) => screen.queryAllByRole('button', { name })[0] ?? null

describe('SpreadsheetTable — editable (default)', () => {
  it('edits a cell and reports it', () => {
    const onCellChange = vi.fn()
    const onDataChange = vi.fn()
    render(<SpreadsheetTable columns={columns} data={data} onCellChange={onCellChange} onDataChange={onDataChange} />)
    tryToEdit('Ada', 'Grace')
    expect(onCellChange).toHaveBeenCalledWith(0, 'name', 'Grace')
    expect(onDataChange).toHaveBeenLastCalledWith([{ name: 'Grace', city: 'London' }, data[1]])
    expect(screen.getByDisplayValue('Grace')).toBeTruthy()
  })

  it('clears a cell with Delete', () => {
    const onCellChange = vi.fn()
    render(<SpreadsheetTable columns={columns} data={data} onCellChange={onCellChange} />)
    tryToClear('Wilmslow')
    expect(onCellChange).toHaveBeenCalledWith(1, 'city', '')
  })

  it('keeps the editing tools', () => {
    render(<SpreadsheetTable columns={columns} data={data} />)
    for (const name of ['Add row', 'Empty this sheet', 'Find and replace', 'Settings']) {
      expect(button(name)).not.toBeNull()
    }
  })
})

describe('SpreadsheetTable — readOnly', () => {
  it('ignores edit attempts', () => {
    const onCellChange = vi.fn()
    const onDataChange = vi.fn()
    render(<SpreadsheetTable readOnly columns={columns} data={data} onCellChange={onCellChange} onDataChange={onDataChange} />)
    tryToEdit('Ada', 'Grace')
    tryToClear('Wilmslow')
    expect(onCellChange).not.toHaveBeenCalled()
    expect(onDataChange).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Ada')).toBeTruthy()
    expect(screen.getByDisplayValue('Wilmslow')).toBeTruthy()
  })

  it('drops editing tools and keeps viewing tools', () => {
    render(<SpreadsheetTable readOnly columns={columns} data={data} />)
    for (const name of ['Add row', 'Empty this sheet', 'Find and replace', 'Reload data', 'Custom formula functions']) {
      expect(button(name)).toBeNull()
    }
    expect(button('Settings')).not.toBeNull()
    expect(screen.getAllByRole('button', { name: 'Sort' }).length).toBeGreaterThan(0)
  })

  it('locks only the columns marked meta.readOnly', () => {
    const onCellChange = vi.fn()
    const mixed: ColumnDef<Row>[] = [columns[0], { ...columns[1], meta: { readOnly: true } }]
    render(<SpreadsheetTable columns={mixed} data={data} onCellChange={onCellChange} />)
    tryToEdit('London', 'Paris')
    tryToClear('Wilmslow')
    expect(onCellChange).not.toHaveBeenCalled()
    tryToEdit('Alan', 'Turing')
    expect(onCellChange).toHaveBeenCalledWith(1, 'name', 'Turing')
  })
})
