import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import type { ColumnDef } from '@tanstack/react-table'
import { ListTable } from './ListTable'
import { fakeScroller, wheel } from '../test/scroller'

type Row = { name: string }
const columns: ColumnDef<Row, any>[] = [{ accessorKey: 'name', header: 'Name' }]
const data = [{ name: 'Ada' }]

const scroller = (container: HTMLElement) => container.querySelector('.jtl-scroll') as HTMLElement

describe('ListTable — horizontal wheel', () => {
  it('turns Shift + wheel into horizontal scrolling inside the table', () => {
    const { container } = render(<ListTable columns={columns} data={data} />)
    const el = scroller(container)
    fakeScroller(el, 1000, 400)
    const event = wheel(el, { deltaY: 120, shiftKey: true })
    expect(el.scrollLeft).toBe(120)
    expect(event.defaultPrevented).toBe(true)
    wheel(el, { deltaY: -50, shiftKey: true })
    expect(el.scrollLeft).toBe(70)
  })

  it('passes the event to the page at the edge, and leaves vertical and native horizontal wheels alone', () => {
    const { container } = render(<ListTable columns={columns} data={data} />)
    const el = scroller(container)
    fakeScroller(el, 1000, 400, 600)
    expect(wheel(el, { deltaY: 120, shiftKey: true }).defaultPrevented).toBe(false)
    expect(el.scrollLeft).toBe(600)
    expect(wheel(el, { deltaY: 120 }).defaultPrevented).toBe(false)
    expect(wheel(el, { deltaX: 40, shiftKey: true }).defaultPrevented).toBe(false)
    fakeScroller(el, 1000, 400, 0)
    expect(wheel(el, { deltaY: -120, shiftKey: true }).defaultPrevented).toBe(false)
  })

  it('stops at the edge instead of overshooting', () => {
    const { container } = render(<ListTable columns={columns} data={data} />)
    const el = scroller(container)
    fakeScroller(el, 1000, 400, 550)
    wheel(el, { deltaY: 120, shiftKey: true })
    expect(el.scrollLeft).toBe(600)
  })
})
