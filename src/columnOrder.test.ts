/**
 * Guard for the A1 reference scheme.
 *
 * `DATA_COLUMN_IDS` is hand-maintained, and letters are positional: inserting a
 * column into the middle of `tableModels` silently re-letters everything after
 * it, which would change what already-saved formulas compute. This test fails
 * loudly when the two drift apart.
 */
import { describe, it, expect } from 'vitest'
import { columns } from './tableModels'
import { DATA_COLUMN_IDS, NON_DATA_COLUMN_IDS } from './columnOrder'

type AnyDef = {
  id?: string
  accessorKey?: string
  columns?: AnyDef[]
}

function leafIds(defs: AnyDef[], into: string[] = []) {
  for (const def of defs) {
    if (def.columns?.length) {
      leafIds(def.columns, into)
      continue
    }
    const id = def.id ?? def.accessorKey
    if (id) into.push(id)
  }
  return into
}

describe('columnOrder — A1 letter guard', () => {
  const actual = leafIds(columns as AnyDef[]).filter(
    (id) => !NON_DATA_COLUMN_IDS.includes(id),
  )

  it('DATA_COLUMN_IDS matches the leaf columns in tableModels, in order', () => {
    expect(actual).toEqual(DATA_COLUMN_IDS)
  })

  it('no duplicate ids', () => {
    expect(new Set(DATA_COLUMN_IDS).size).toBe(DATA_COLUMN_IDS.length)
  })
})
