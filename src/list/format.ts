export type DatePattern = 'dd-MMM-yyyy' | 'dd-MMM-yyyy HH:mm' | 'dd/MM/yyyy' | 'yyyy-MM-dd' | 'relative'
export type Grouping = 'standard' | 'indian' | 'none'

export type ColumnFormat =
  | { kind: 'date'; pattern?: DatePattern }
  | { kind: 'number'; decimals?: number; grouping?: Grouping }
  | { kind: 'currency'; currency?: string; decimals?: number; grouping?: Grouping; minorUnits?: boolean }
  | { kind: 'percent'; decimals?: number; whole?: boolean }
  | { kind: 'text'; overflow?: 'truncate' | 'wrap' }

export type FormatKind = ColumnFormat['kind']
export type ColumnFormats = Record<string, ColumnFormat>

export type FormatOptions = {
  locale?: string
  dateFormat?: DatePattern
  now?: Date
}

export const DATE_PATTERNS: DatePattern[] = ['dd-MMM-yyyy', 'dd-MMM-yyyy HH:mm', 'dd/MM/yyyy', 'yyyy-MM-dd', 'relative']

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>()

function cached<T extends Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>(key: string, make: () => T): T {
  let hit = cache.get(key) as T | undefined
  if (!hit) {
    hit = make()
    cache.set(key, hit)
  }
  return hit
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return new Date(value)
  if (typeof value !== 'string' || !value.trim()) return null
  const text = value.trim()
  if (ISO_DATE.test(text)) {
    const [year, month, day] = text.split('-').map(Number)
    return new Date(year, month - 1, day)
  }
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 30],
  ['month', 12],
  ['year', Infinity],
]

function relative(date: Date, locale: string | undefined, now: Date): string {
  let amount = (date.getTime() - now.getTime()) / 1000
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(amount) < size) {
      const format = cached(`rel|${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }))
      return format.format(Math.round(amount), unit)
    }
    amount /= size
  }
  return ''
}

function formatDate(value: unknown, pattern: DatePattern, options: FormatOptions): string {
  const date = toDate(value)
  if (!date) return String(value)
  if (pattern === 'relative') return relative(date, options.locale, options.now ?? new Date())
  const day = pad(date.getDate())
  const month = date.getMonth() + 1
  const year = date.getFullYear()
  if (pattern === 'dd/MM/yyyy') return `${day}/${pad(month)}/${year}`
  if (pattern === 'yyyy-MM-dd') return `${year}-${pad(month)}-${day}`
  const months = cached(`mon|${options.locale}`, () => new Intl.DateTimeFormat(options.locale, { month: 'short' }))
  const text = `${day}-${months.format(date)}-${year}`
  return pattern === 'dd-MMM-yyyy HH:mm' ? `${text} ${pad(date.getHours())}:${pad(date.getMinutes())}` : text
}

const numberLocale = (grouping: Grouping | undefined, locale: string | undefined) =>
  grouping === 'indian' ? 'en-IN' : locale

function numberFormat(locale: string | undefined, grouping: Grouping | undefined, options: Intl.NumberFormatOptions) {
  const resolved = numberLocale(grouping, locale)
  const full = { ...options, useGrouping: grouping !== 'none' }
  return cached(`num|${resolved}|${JSON.stringify(full)}`, () => new Intl.NumberFormat(resolved, full))
}

const digits = (decimals?: number): Intl.NumberFormatOptions =>
  decimals === undefined ? {} : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }

function currencyDigits(currency: string, locale?: string): number {
  return numberFormat(locale, 'standard', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

function formatNumber(value: unknown, format: Exclude<ColumnFormat, { kind: 'date' | 'text' }>, locale?: string): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (typeof value === 'boolean' || (typeof value === 'string' && !value.trim()) || !Number.isFinite(n)) return String(value)
  if (format.kind === 'number') return numberFormat(locale, format.grouping, digits(format.decimals)).format(n)
  if (format.kind === 'percent') {
    return numberFormat(locale, 'standard', { style: 'percent', ...digits(format.decimals) }).format(format.whole ? n / 100 : n)
  }
  const currency = format.currency ?? 'USD'
  const amount = format.minorUnits ? n / 10 ** currencyDigits(currency, locale) : n
  return numberFormat(locale, format.grouping, { style: 'currency', currency, ...digits(format.decimals) }).format(amount)
}

export function formatValue(value: unknown, format: ColumnFormat | undefined, options: FormatOptions = {}): string {
  if (value === null || value === undefined) return ''
  if (!format || format.kind === 'text') return String(value)
  if (format.kind === 'date') return formatDate(value, format.pattern ?? options.dateFormat ?? 'dd-MMM-yyyy', options)
  return formatNumber(value, format, options.locale)
}

export function inferKind(values: unknown[]): FormatKind | undefined {
  const sample = values.find((value) => value !== null && value !== undefined && value !== '')
  if (sample instanceof Date) return 'date'
  if (typeof sample === 'number') return 'number'
  if (typeof sample !== 'string') return undefined
  return ISO_DATE.test(sample) || ISO_DATETIME.test(sample) ? 'date' : 'text'
}
