import React from 'react'
import type { Column } from '@tanstack/react-table'
import { useLabels } from './labelsContext'
import { useDebouncedCommit } from './useDebouncedCommit'

type Props<TData> = {
  column: Column<TData, unknown>
  label: string
  delay: number
}

export function FilterInput<TData>({ column, label, delay }: Props<TData>) {
  const labels = useLabels()
  const committed = String(column.getFilterValue() ?? '')
  const [text, setText] = React.useState(committed)
  React.useEffect(() => setText(committed), [committed])
  useDebouncedCommit(text, committed, delay, (next) => column.setFilterValue(next || undefined))
  return (
    <input
      type="search"
      value={text}
      onChange={(event) => setText(event.target.value)}
      aria-label={labels.filter(label)}
      placeholder={labels.filterPlaceholder}
      className="jtl-input jtl-input--filter"
    />
  )
}
