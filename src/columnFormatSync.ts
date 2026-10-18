import React from 'react'
import { columnTypeOverrides, type ColumnTypeOverride } from './columnTypeOverrides'

export type ColumnFormatOverrides = Record<string, ColumnTypeOverride>

const sameFormats = (a: ColumnFormatOverrides, b: ColumnFormatOverrides) =>
  JSON.stringify(a) === JSON.stringify(b)

export function useColumnFormatSync(
  value: ColumnFormatOverrides | undefined,
  onChange: ((formats: ColumnFormatOverrides) => void) | undefined,
) {
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange
  React.useLayoutEffect(() => {
    if (value && !sameFormats(value, columnTypeOverrides.snapshot())) columnTypeOverrides.restore(value)
  }, [value])
  React.useEffect(
    () => columnTypeOverrides.subscribe(() => onChangeRef.current?.(columnTypeOverrides.snapshot())),
    [],
  )
}
