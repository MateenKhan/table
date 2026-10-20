export type MergeRegion = {
  anchorRow: number
  anchorCol: number
  rowSpan: number
  colSpan: number
}

export type MergeMap = MergeRegion[]

export function findMerge(
  merges: MergeMap,
  dataRowIndex: number,
  colIndex: number,
): MergeRegion | undefined {
  return merges.find(
    (m) =>
      dataRowIndex >= m.anchorRow &&
      dataRowIndex < m.anchorRow + m.rowSpan &&
      colIndex >= m.anchorCol &&
      colIndex < m.anchorCol + m.colSpan,
  )
}

export function isAnchor(
  m: MergeRegion,
  dataRowIndex: number,
  colIndex: number,
): boolean {
  return m.anchorRow === dataRowIndex && m.anchorCol === colIndex
}

export function isMergeConsumed(
  merges: MergeMap,
  dataRowIndex: number,
  colIndex: number,
): boolean {
  const m = findMerge(merges, dataRowIndex, colIndex)
  return !!m && !isAnchor(m, dataRowIndex, colIndex)
}

export function mergeRegionsOverlap(a: MergeRegion, b: MergeRegion): boolean {
  return (
    a.anchorRow < b.anchorRow + b.rowSpan &&
    a.anchorRow + a.rowSpan > b.anchorRow &&
    a.anchorCol < b.anchorCol + b.colSpan &&
    a.anchorCol + a.colSpan > b.anchorCol
  )
}

export function addMerge(
  merges: MergeMap,
  region: MergeRegion,
): MergeMap {
  const cleaned = merges.filter((m) => !mergeRegionsOverlap(m, region))
  return [...cleaned, region]
}

export function removeMergesIn(
  merges: MergeMap,
  top: number,
  left: number,
  bottom: number,
  right: number,
): MergeMap {
  const probe: MergeRegion = {
    anchorRow: top,
    anchorCol: left,
    rowSpan: bottom - top + 1,
    colSpan: right - left + 1,
  }
  return merges.filter((m) => !mergeRegionsOverlap(m, probe))
}

export function hasUnmergeableRegion(
  merges: MergeMap,
  top: number,
  left: number,
  bottom: number,
  right: number,
): boolean {
  const probe: MergeRegion = {
    anchorRow: top,
    anchorCol: left,
    rowSpan: bottom - top + 1,
    colSpan: right - left + 1,
  }
  return merges.some((m) => mergeRegionsOverlap(m, probe))
}
