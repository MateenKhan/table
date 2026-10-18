import { describe, expect, it } from 'vitest'
import { formatValue, inferKind } from './format'

const at = { locale: 'en-US' }

describe('formatValue', () => {
  it('formats dates with the supported patterns', () => {
    const value = '2026-10-18T09:05:00'
    expect(formatValue('2026-10-18', { kind: 'date' }, at)).toBe('18-Oct-2026')
    expect(formatValue(value, { kind: 'date', pattern: 'dd-MMM-yyyy HH:mm' }, at)).toBe('18-Oct-2026 09:05')
    expect(formatValue(value, { kind: 'date', pattern: 'dd/MM/yyyy' }, at)).toBe('18/10/2026')
    expect(formatValue(new Date(2026, 0, 5), { kind: 'date', pattern: 'yyyy-MM-dd' }, at)).toBe('2026-01-05')
    expect(formatValue('2026-10-18', { kind: 'date' }, { ...at, dateFormat: 'dd/MM/yyyy' })).toBe('18/10/2026')
    expect(formatValue('not a date', { kind: 'date' }, at)).toBe('not a date')
  })

  it('formats relative dates', () => {
    const now = new Date(2026, 9, 18, 12)
    expect(formatValue(new Date(2026, 9, 15, 12), { kind: 'date', pattern: 'relative' }, { ...at, now })).toBe('3 days ago')
    expect(formatValue(new Date(2026, 9, 18, 14), { kind: 'date', pattern: 'relative' }, { ...at, now })).toBe('in 2 hours')
  })

  it('formats numbers with decimals and grouping', () => {
    expect(formatValue(1234567.891, { kind: 'number', decimals: 2 }, at)).toBe('1,234,567.89')
    expect(formatValue(1234567.891, { kind: 'number', decimals: 2, grouping: 'indian' }, at)).toBe('12,34,567.89')
    expect(formatValue(1234567.891, { kind: 'number', decimals: 0, grouping: 'none' }, at)).toBe('1234568')
    expect(formatValue('n/a', { kind: 'number' }, at)).toBe('n/a')
  })

  it('formats currency, including values stored in minor units', () => {
    expect(formatValue(1234.5, { kind: 'currency', currency: 'USD' }, at)).toBe('$1,234.50')
    expect(formatValue(123450, { kind: 'currency', currency: 'USD', minorUnits: true }, at)).toBe('$1,234.50')
    expect(formatValue(123456789, { kind: 'currency', currency: 'INR', minorUnits: true, grouping: 'indian' }, at)).toBe('₹12,34,567.89')
    expect(formatValue(500, { kind: 'currency', currency: 'JPY', minorUnits: true }, at)).toBe('¥500')
  })

  it('formats percentages from ratios or whole numbers', () => {
    expect(formatValue(0.125, { kind: 'percent', decimals: 1 }, at)).toBe('12.5%')
    expect(formatValue(12.5, { kind: 'percent', decimals: 1, whole: true }, at)).toBe('12.5%')
  })

  it('passes text through and leaves empty values empty', () => {
    expect(formatValue('Hello', { kind: 'text' }, at)).toBe('Hello')
    expect(formatValue(null, { kind: 'number' }, at)).toBe('')
    expect(formatValue(undefined, { kind: 'date' }, at)).toBe('')
  })
})

describe('inferKind', () => {
  it('recognises dates and text but leaves numbers raw', () => {
    expect(inferKind(['2026-10-18', '2026-10-19'])).toBe('date')
    expect(inferKind([null, '2026-10-18T10:00:00Z'])).toBe('date')
    expect(inferKind([new Date()])).toBe('date')
    expect(inferKind(['Ada'])).toBe('text')
    expect(inferKind([42])).toBe('number')
    expect(inferKind([])).toBeUndefined()
  })
})
