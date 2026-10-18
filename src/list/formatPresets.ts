import { DATE_PATTERNS, formatValue, type ColumnFormat, type FormatKind, type FormatOptions } from './format'
import type { ListLabels } from './labels'

export type FormatPreset = { id: string; patch: Partial<ColumnFormat> & Record<string, unknown> }

const NUMBER: FormatPreset[] = [
  { id: 'number-0', patch: { kind: 'number', decimals: 0, grouping: 'standard' } },
  { id: 'number-2', patch: { kind: 'number', decimals: 2, grouping: 'standard' } },
  { id: 'number-indian-2', patch: { kind: 'number', decimals: 2, grouping: 'indian' } },
  { id: 'number-plain-2', patch: { kind: 'number', decimals: 2, grouping: 'none' } },
]

const PERCENT: FormatPreset[] = [0, 1, 2].map((decimals) => ({
  id: `percent-${decimals}`,
  patch: { kind: 'percent', decimals },
}))

const PRESETS: Record<FormatKind, FormatPreset[]> = {
  date: DATE_PATTERNS.map((pattern) => ({ id: pattern, patch: { kind: 'date', pattern } })),
  number: [...NUMBER, ...PERCENT],
  percent: [...PERCENT, ...NUMBER],
  currency: [
    { id: 'currency', patch: { kind: 'currency', grouping: 'standard', decimals: undefined } },
    { id: 'currency-indian', patch: { kind: 'currency', grouping: 'indian', decimals: undefined } },
    { id: 'currency-0', patch: { kind: 'currency', grouping: 'standard', decimals: 0 } },
  ],
  text: [
    { id: 'truncate', patch: { kind: 'text', overflow: 'truncate' } },
    { id: 'wrap', patch: { kind: 'text', overflow: 'wrap' } },
  ],
}

export const presetsFor = (kind: FormatKind) => PRESETS[kind]

export function applyPreset(base: ColumnFormat, preset: FormatPreset): ColumnFormat {
  const merged: Record<string, unknown> = { ...base, ...preset.patch }
  for (const key of Object.keys(merged)) if (merged[key] === undefined) delete merged[key]
  return merged as ColumnFormat
}

export function matchPreset(kind: FormatKind, format: ColumnFormat | undefined): string {
  if (!format) return ''
  const values = format as Record<string, unknown>
  const hit = PRESETS[kind].find((preset) =>
    Object.entries(preset.patch).every(([key, value]) => values[key] === value),
  )
  return hit?.id ?? ''
}

const SAMPLE_NUMBER = 1234567.891

export function presetLabel(base: ColumnFormat, preset: FormatPreset, options: FormatOptions, labels: ListLabels): string {
  const format = applyPreset(base, preset)
  if (format.kind === 'text') return format.overflow === 'wrap' ? labels.wrap : labels.truncate
  if (format.kind === 'date') return format.pattern === 'relative' ? labels.relative : (format.pattern ?? '')
  if (format.kind === 'percent') return formatValue(format.whole ? 25 : 0.25, format, options)
  if (format.kind === 'currency' && format.minorUnits) return formatValue(123456789, format, options)
  return formatValue(SAMPLE_NUMBER, format, options)
}
