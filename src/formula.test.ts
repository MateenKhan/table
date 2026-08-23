// Dependency-free unit tests for the formula engine.
// Run with:  npx tsx src/formula.test.ts
import {
  evaluateFormula,
  extractReferences,
  translateFormula,
  parseFormula,
  stringifyFormula,
  recalcFormulas,
  isFormula,
  createFunctionRegistry,
  customFunctions,
  findCircularKeys,
  migrateLegacyA1Formula,
  migrateLegacyA1Formulas,
  renameSheetInFormula,
  renameSheetInFormulas,
  sheetNameKey,
  sheetRefText,
  isBareSheetName,
  ERROR_CIRCULAR,
  ERROR_QUOTE,
  ERROR_REF,
} from './formula'
import type { CrossSheetSheet, FormulaMap } from './formula'
import {
  DATA_COLUMN_IDS,
  columnDeltaBetween,
  columnIdFromLetters,
  columnIndexForId,
  columnLetters,
  dataColumnIdsFromDefs,
  getLetterSpace,
  lettersForColumnId,
  lettersToIndex,
  observeLetterColumn,
  resetLetterSpace,
  setLetterSpace,
} from './columnOrder'
import { blankColumns } from './blankSheet'
import {
  DEFAULT_SHEET_NAME,
  normalizeSheetName,
  uniqueSheetName,
} from './sheetRegistry'
import type { SheetInfo } from './sheetRegistry'
import { highlightFormula } from './formulaHighlight'
import { parseTSV, serializeTSV } from './clipboard'
import {
  applyFormulaPatch,
  cellWritesFor,
  HistoryEntry,
  isEmptyEntry,
  makeEntry,
  pushHistory,
} from './undo'

type Row = { age: number; visits: number; progress: number; firstName: string }

const data: Row[] = [
  { age: 10, visits: 100, progress: 5, firstName: 'Ann' },
  { age: 20, visits: 200, progress: 0, firstName: 'Bob' },
  { age: 30, visits: 300, progress: 15, firstName: 'Cid' },
  { age: 40, visits: 400, progress: 25, firstName: 'Dee' },
]

const ctx = (row: number) => ({
  currentRow: row,
  getCell: (r: number, c: string) =>
    (data[r] as unknown as Record<string, unknown> | undefined)?.[c],
})

let passed = 0
let failed = 0

const check = (label: string, actual: unknown, expected: unknown) => {
  if (Object.is(actual, expected)) {
    passed++
    console.log(`  ok   ${label}  ->  ${String(actual)}`)
  } else {
    failed++
    console.log(
      `  FAIL ${label}  ->  got ${String(actual)}, want ${String(expected)}`,
    )
  }
}

const ev = (src: string, row = 0) => {
  const result = evaluateFormula(src, ctx(row))
  return result.ok ? result.value : result.error
}

console.log('\n-- evaluation (row 0 unless noted) --')
check('=age*2', ev('=age*2'), 20)
check('=visits+progress', ev('=visits+progress'), 105)
check('=1+2*3', ev('=1+2*3'), 7)
check('=(1+2)*3', ev('=(1+2)*3'), 9)
check('=-age', ev('=-age'), -10)
check('=2^3^2 (right assoc)', ev('=2^3^2'), 512)
check('=10/4', ev('=10/4'), 2.5)
check('=age/progress on row 1', ev('=age/progress', 1), '#DIV/0!')
check('=SUM(age, visits, 5)', ev('=SUM(age, visits, 5)'), 115)
check('=AVG(1,2,3,4)', ev('=AVG(1,2,3,4)'), 2.5)
check('=MIN(age, visits)', ev('=MIN(age, visits)'), 10)
check('=MAX(age, visits)', ev('=MAX(age, visits)'), 100)
check('=ROUND(10/3, 2)', ev('=ROUND(10/3, 2)'), 3.33)
check('=ROUND(2.5)', ev('=ROUND(2.5)'), 3)
check('=ROUND(-2.5) half away from zero', ev('=ROUND(-2.5)'), -3)
check('=ABS(0-7)', ev('=ABS(0-7)'), 7)
check('=age[3] row ref (1-based)', ev('=age[3]'), 30)
check('=age[$1] from row 2', ev('=age[$1]', 2), 10)
check('=SUM(age[1]:age[4])', ev('=SUM(age[1]:age[4])'), 100)
check('=COUNT(age[1]:age[4])', ev('=COUNT(age[1]:age[4])'), 4)
check('=AVG(visits[1]:visits[4])', ev('=AVG(visits[1]:visits[4])'), 250)
check('=age from row 2', ev('=age', 2), 30)
check('lowercase fn name', ev('=sum(age, 1)'), 11)
check('text column ref', ev('=firstName*2'), '#ERROR')
check('unknown function', ev('=FOO(1)'), '#ERROR')
check('unbalanced paren', ev('=(1+2'), '#ERROR')
check('garbage characters', ev('=@@@'), '#ERROR')
check('empty formula', ev('='), '#ERROR')
check('range across columns', ev('=SUM(age[1]:visits[2])'), '#ERROR')
check('range used as scalar', ev('=age[1]:age[2] + 1'), '#ERROR')
check('trailing operator', ev('=age *'), '#ERROR')

console.log('\n-- isFormula --')
check('isFormula("=1")', isFormula('=1'), true)
check('isFormula("1")', isFormula('1'), false)
check('isFormula(5)', isFormula(5), false)

console.log('\n-- parse / stringify round trip --')
const rt = (src: string) => stringifyFormula(parseFormula(src)!)
check('=age*2+1', rt('=age*2+1'), '=age * 2 + 1')
check('=(1+2)*3 keeps parens', rt('=(1+2)*3'), '=(1 + 2) * 3')
check('=age-(visits-progress)', rt('=age-(visits-progress)'), '=age - (visits - progress)')
check('=age-visits+progress', rt('=age-visits+progress'), '=age - visits + progress')
check('=-(age+visits)', rt('=-(age+visits)'), '=-(age + visits)')
check('=SUM(age[1]:age[4])', rt('=SUM(age[1]:age[4])'), '=SUM(age[1]:age[4])')
check('=ROUND(age/3, 2)', rt('=ROUND(age/3, 2)'), '=ROUND(age / 3, 2)')

console.log('\n-- relative translation (fill by N rows) --')
check('bare col ref is already relative', translateFormula('=age*2', 3), '=age*2')
check('=age[1]+1 by 3', translateFormula('=age[1]+1', 3), '=age[4] + 1')
check('=age[$1]+1 by 3 stays absolute', translateFormula('=age[$1]+1', 3), '=age[$1]+1')
check('=SUM(age[1]:age[3]) by 2', translateFormula('=SUM(age[1]:age[3])', 2), '=SUM(age[3]:age[5])')
check('mixed abs + rel by 5', translateFormula('=age[2]+age[$2]', 5), '=age[7] + age[$2]')
check('negative delta clamps to row 1', translateFormula('=age[2]', -10), '=age[1]')
check('unparseable passes through', translateFormula('=(((', 3), '=(((')
check('delta 0 is identity', translateFormula('=age[1]  +1', 0), '=age[1]  +1')

console.log('\n-- recalcFormulas --')
const formulas = {
  '0:doubled': '=age*2',
  '1:doubled': '=age*2',
  '0:chained': '=doubled+1',
  '1:chained': '=doubled+1',
}
const base = [
  { age: 10, doubled: 0 as unknown, chained: 0 as unknown },
  { age: 20, doubled: 0 as unknown, chained: 0 as unknown },
]
const out = recalcFormulas(base, formulas)
check('row0 doubled', out[0].doubled, 20)
check('row1 doubled', out[1].doubled, 40)
check('row0 chained settles in one call', out[0].chained, 21)
check('row1 chained settles in one call', out[1].chained, 41)
check('returns a new array when changed', out !== base, true)
check('idempotent (same reference back)', recalcFormulas(out, formulas) === out, true)
check('no formulas -> same reference', recalcFormulas(base, {}) === base, true)
check(
  'bad formula stores #ERROR',
  recalcFormulas(base, { '0:doubled': '=@@' })[0].doubled,
  '#ERROR',
)
check(
  'out-of-range data index is skipped',
  recalcFormulas(base, { '99:doubled': '=age*2' }) === base,
  true,
)

/* ======================================================== A1 references == */

console.log('\n-- letter <-> column index --')
check('columnLetters(0)', columnLetters(0), 'A')
check('columnLetters(25)', columnLetters(25), 'Z')
check('columnLetters(26)', columnLetters(26), 'AA')
check('columnLetters(27)', columnLetters(27), 'AB')
check('columnLetters(701)', columnLetters(701), 'ZZ')
check('columnLetters(702)', columnLetters(702), 'AAA')
check('columnLetters(-1)', columnLetters(-1), '')
check('lettersToIndex("A")', lettersToIndex('A'), 0)
check('lettersToIndex("z") case-insensitive', lettersToIndex('z'), 25)
check('lettersToIndex("AA")', lettersToIndex('AA'), 26)
check('lettersToIndex("ZZ")', lettersToIndex('ZZ'), 701)
check('lettersToIndex("AAA")', lettersToIndex('AAA'), 702)
check('lettersToIndex("A1") rejected', lettersToIndex('A1'), -1)
check('lettersToIndex("") rejected', lettersToIndex(''), -1)
check('lettersToIndex(long) rejected', lettersToIndex('ABCDEFGH'), -1)
check(
  'letters round trip over every index',
  DATA_COLUMN_IDS.every((_, index) => lettersToIndex(columnLetters(index)) === index),
  true,
)

console.log('\n-- letters map to definition order, select excluded --')
check('A is the first data column', columnIdFromLetters('A'), 'avatar')
check('B', columnIdFromLetters('B'), 'firstName')
check('D is the derived fullName', columnIdFromLetters('D'), 'fullName')
check('E', columnIdFromLetters('E'), 'age')
check('F', columnIdFromLetters('F'), 'visits')
check('J is the last data column', columnIdFromLetters('J'), 'attachment')
check('K is past the end', columnIdFromLetters('K'), '')
check('lettersForColumnId(age)', lettersForColumnId('age'), 'E')
check('lettersForColumnId(select) is unmapped', lettersForColumnId('select'), '')

// A row shape with every data column present, so letters can be exercised.
type GridRow = Record<string, unknown>

const attachmentValue = { name: 'notes.txt', mime: 'text/plain', size: 4, url: 'data:,', isObjectUrl: false }

const grid: GridRow[] = [
  { avatar: null, firstName: 'Ann', lastName: 'Ant', age: 10, visits: 100, status: 'single', progress: 5, salary: 1000, attachment: null },
  { avatar: attachmentValue, firstName: 'Bob', lastName: 'Bee', age: 20, visits: 200, status: 'single', progress: 0, salary: 2000, attachment: attachmentValue },
  { avatar: null, firstName: 'Cid', lastName: 'Cow', age: 30, visits: 300, status: 'complicated', progress: 15, salary: 3000, attachment: null },
  { avatar: null, firstName: 'Dee', lastName: 'Doe', age: 40, visits: 400, status: 'single', progress: 25, salary: 4000, attachment: null },
]

const gctx = (row: number) => ({
  currentRow: row,
  getCell: (r: number, c: string) => grid[r]?.[c],
})

const gev = (src: string, row = 0) => {
  const result = evaluateFormula(src, gctx(row))
  return result.ok ? result.value : result.error
}

console.log('\n-- A1 evaluation --')
check('=E1 is age row 1', gev('=E1'), 10)
check('=E1+F2', gev('=E1+F2'), 210)
check('lowercase =e1', gev('=e1'), 10)
check('=E1*2', gev('=E1*2'), 20)
check('=I1 salary', gev('=I1'), 1000)
check('=$E$1 from row 2', gev('=$E$1', 2), 10)
check('=E$1 from row 2', gev('=E$1', 2), 10)
check('=$E1 from row 2', gev('=$E1', 2), 10)
check('=E1 + age mixed notation (row 1)', gev('=E1 + age', 1), 30)
check('=SUM(E1:E4)', gev('=SUM(E1:E4)'), 100)
check('=COUNT(E1:E4)', gev('=COUNT(E1:E4)'), 4)
check('=AVG(F1:F4)', gev('=AVG(F1:F4)'), 250)
check('=MAX(E1:E4)', gev('=MAX(E1:E4)'), 40)
check('rectangular =SUM(E1:F2)', gev('=SUM(E1:F2)'), 330)
check('rectangular =COUNT(E1:F2)', gev('=COUNT(E1:F2)'), 4)
check('rectangular reversed =SUM(F2:E1)', gev('=SUM(F2:E1)'), 330)
check('rectangular with $ anchors', gev('=SUM($E$1:$F$2)'), 330)
check('=SUM(E1:E4)/COUNT(E1:E4)', gev('=SUM(E1:E4)/COUNT(E1:E4)'), 25)
check('A1 node is a plain ref node', parseFormula('=E1')!.kind, 'ref')
check('A1 range is a plain range node', parseFormula('=E1:E4')!.kind, 'range')

console.log('\n-- A1 failure modes --')
check('letter past last column', gev('=K1'), '#ERROR')
check('multi-letter past last column', gev('=ZZ1'), '#ERROR')
check('row 0 does not exist', gev('=E0'), '#ERROR')
check('avatar (attachment column, empty)', gev('=A1'), '#ERROR')
check('attachment column (filled)', gev('=J2'), '#ERROR')
check('range over an attachment column', gev('=SUM(A1:A2)'), '#ERROR')
check('fullName is derived text', gev('=D1'), '#ERROR')
check('status is text', gev('=G1'), '#ERROR')
check('mixed-notation range rejected', gev('=SUM(E1:age[2])'), '#ERROR')
check('named cross-column range still rejected', gev('=SUM(age[1]:visits[2])'), '#ERROR')
check('huge rectangular range is guarded', gev('=SUM(E1:F20000)'), '#ERROR')
check('lone $ is not a formula', gev('=$'), '#ERROR')
check('$ before a column id', gev('=$age'), '#ERROR')
check('unknown column id still reads as empty', gev('=nosuchcolumn+1'), 1)
check('bare letter is not a cell reference', gev('=E+1'), 1)

console.log('\n-- A1 round trip --')
check('=A1+B2', rt('=A1+B2'), '=A1 + B2')
check('=$A$1', rt('=$A$1'), '=$A$1')
check('=A$1', rt('=A$1'), '=A$1')
check('=$A1', rt('=$A1'), '=$A1')
check('lowercase normalises', rt('=a1'), '=A1')
check('=AA12 multi-letter', rt('=AA12'), '=AA12')
check('=SUM(A1:A5)', rt('=SUM(A1:A5)'), '=SUM(A1:A5)')
check('=SUM(A1:C5) rectangular', rt('=SUM(A1:C5)'), '=SUM(A1:C5)')
check('=SUM($A$1:$C$5)', rt('=SUM($A$1:$C$5)'), '=SUM($A$1:$C$5)')
check('mixed anchors in a range', rt('=SUM($A1:C$5)'), '=SUM($A1:C$5)')
check('=A1 + age keeps both notations', rt('=A1 + age'), '=A1 + age')
check('named refs are not rewritten to letters', rt('=age[1]'), '=age[1]')
check('named ref with $ stays named', rt('=age[$1]'), '=age[$1]')
check('=ROUND(A1/B2, 2)', rt('=ROUND(A1/B2, 2)'), '=ROUND(A1 / B2, 2)')

console.log('\n-- A1 fill translation --')
check('=A1+1 by 3', translateFormula('=A1+1', 3), '=A4 + 1')
check('=$A1+1 by 3 (row still relative)', translateFormula('=$A1+1', 3), '=$A4 + 1')
check('=$A$1+1 by 3 stays put', translateFormula('=$A$1+1', 3), '=$A$1+1')
check('=A$1+1 by 3 stays put', translateFormula('=A$1+1', 3), '=A$1+1')
check('=SUM(A1:A3) by 2', translateFormula('=SUM(A1:A3)', 2), '=SUM(A3:A5)')
check('=A2 by -10 clamps to row 1', translateFormula('=A2', -10), '=A1')
check('mixed A1 + named by 2', translateFormula('=A1+age[1]', 2), '=A3 + age[3]')
check('column shift moves un-anchored letters', translateFormula('=A1', 0, 2), '=C1')
check('column shift skips $-anchored letters', translateFormula('=$A1', 0, 2), '=$A1')
check('row + column shift together', translateFormula('=A1+age', 1, 1), '=B2 + age')
check('column shift clamps at column A', translateFormula('=C1', 0, -10), '=A1')
check('no deltas is identity', translateFormula('=A1', 0, 0), '=A1')

/* ============================================ name+row references (age1) == */

console.log('\n-- name+row evaluation --')
check('=age1 is the age column, row 1', gev('=age1'), 10)
check('=visits1 is the visits column, row 1', gev('=visits1'), 100)
check('=salary1', gev('=salary1'), 1000)
check('=age2 is age row 2', gev('=age2'), 20)
check('=visits3 is visits row 3', gev('=visits3'), 300)
check('=age1*visits1', gev('=age1*visits1'), 1000)
check('=age1 + visits2', gev('=age1 + visits2'), 210)
check('name+row row past the end reads empty', gev('=visits99'), 0)
check('name+row into a text column errors', gev('=status1*2'), '#ERROR')

console.log('\n-- name+row resolution order --')
// Rule 2 beats A1: `age1` is "age row 1", NOT the out-of-range A1 letters `AGE`.
check(
  '=age1 parses as the age COLUMN (a named ref), not an A1 ref',
  (() => {
    const n = parseFormula('=age1')
    return !!n && n.kind === 'ref' && n.col === 'age' && !n.a1
  })(),
  true,
)
// A genuine A1 token (leading part is not a column) is still A1.
check('=E1 stays an A1 ref', parseFormula('=E1')!.kind === 'ref' && !!(parseFormula('=E1') as any).a1, true)
// The name+row split only fires when the leading part is a KNOWN column id.
// This same `isKnownColumnId` gate is what makes a column literally named `x1`
// win as a whole-column current-row ref (rule 1) instead of splitting to `x`+1.
check('unknown leading part does not become name+row (=zzz1)', gev('=zzz1'), '#ERROR')
// Rule 1: a whole token that is a known column id is a current-row ref.
check(
  '=age (a known column id) is a current-row ref',
  (() => {
    const n = parseFormula('=age')
    return !!n && n.kind === 'ref' && n.col === 'age' && n.row.mode === 'current'
  })(),
  true,
)

console.log('\n-- extractReferences (live highlight source) --')
const refs = (formula: string, row = 0) =>
  JSON.stringify(extractReferences(formula, row))
check('name+row refs', refs('=age1*visits1'), JSON.stringify([
  { columnId: 'age', dataRow: 0 },
  { columnId: 'visits', dataRow: 0 },
]))
check('A1 refs resolve to column ids', refs('=E1+F2'), JSON.stringify([
  { columnId: 'age', dataRow: 0 },
  { columnId: 'visits', dataRow: 1 },
]))
check('bare column ref uses the current data row', refs('=age', 2), JSON.stringify([
  { columnId: 'age', dataRow: 2 },
]))
check('a named range expands to every cell', refs('=SUM(age[1]:age[3])'), JSON.stringify([
  { columnId: 'age', dataRow: 0 },
  { columnId: 'age', dataRow: 1 },
  { columnId: 'age', dataRow: 2 },
]))
check('a rectangular A1 range expands both axes', refs('=SUM(E1:F2)'), JSON.stringify([
  { columnId: 'age', dataRow: 0 },
  { columnId: 'age', dataRow: 1 },
  { columnId: 'visits', dataRow: 0 },
  { columnId: 'visits', dataRow: 1 },
]))
check('references are de-duped', refs('=age1+age1'), JSON.stringify([
  { columnId: 'age', dataRow: 0 },
]))
check('a half-typed formula yields no refs, never throws', refs('=age1*'), JSON.stringify([]))
check('a constant formula references nothing', refs('=1+2'), JSON.stringify([]))
check('an unparseable draft yields no refs, never throws', refs('=((('), JSON.stringify([]))

/* =============================================== custom (user) functions == */

console.log('\n-- defining custom functions --')
const reg = createFunctionRegistry()

const cev = (src: string, row = 0) => {
  const result = evaluateFormula(src, { ...gctx(row), functions: reg })
  return result.ok ? result.value : result.error
}

const define = (name: string, params: string[], body: string) =>
  reg.define({ name, params, body })

const defineError = (name: string, params: string[], body: string) => {
  const result = reg.define({ name, params, body })
  return result.ok ? '(accepted)' : result.error
}

check('define SQFT', define('SQFT', ['w', 'h'], 'w * h / 144').ok, true)
check('=SQFT(12, 12)', cev('=SQFT(12, 12)'), 1)
check('=SQFT(288, 144)', cev('=SQFT(288, 144)'), 288)
check('case-insensitive invocation', cev('=sqft(12, 12)'), 1)
check('nested in an expression', cev('=SQFT(12, 12) + 1'), 2)
check('custom function inside a builtin', cev('=SUM(SQFT(12,12), 9)'), 10)
check('registry version advanced', reg.version > 0, true)
check('listed', reg.list().map((d) => d.name).join(','), 'SQFT')

console.log('\n-- arguments, columns and shadowing --')
check('define SHADOW(age)', define('SHADOW', ['age'], 'age * 2').ok, true)
check('param shadows the age column', cev('=SHADOW(5)'), 10)
check('...while the bare column still reads 10', cev('=age * 2'), 20)
check('define FROMROW', define('FROMROW', ['n'], 'age + n').ok, true)
check('body reads the calling row (row 0)', cev('=FROMROW(5)'), 15)
check('body reads the calling row (row 2)', cev('=FROMROW(5)', 2), 35)
check('define WITHA1', define('WITHA1', [], 'E1 * 2').ok, true)
check('body may use A1 refs', cev('=WITHA1()'), 20)
check('define OVERRANGE', define('OVERRANGE', [], 'SUM(E1:E4)').ok, true)
check('body may use ranges', cev('=OVERRANGE()'), 100)
check('define TAKESRANGE', define('TAKESRANGE', ['r'], 'SUM(r) + 1').ok, true)
check('a range may be passed as an argument', cev('=TAKESRANGE(E1:E4)'), 101)

console.log('\n-- custom functions calling custom functions --')
check('define DOUBLE', define('DOUBLE', ['x'], 'x * 2').ok, true)
check('define QUAD', define('QUAD', ['x'], 'DOUBLE(DOUBLE(x))').ok, true)
check('=QUAD(3)', cev('=QUAD(3)'), 12)
check('define AREA using SQFT', define('AREA', ['a'], 'SQFT(a, a)').ok, true)
check('=AREA(12)', cev('=AREA(12)'), 1)

console.log('\n-- recursion is refused, not hung --')
check('define self-recursive LOOPA', define('LOOPA', ['x'], 'LOOPA(x)').ok, true)
check('direct recursion -> #ERROR', cev('=LOOPA(1)'), '#ERROR')
check('define LOOPB', define('LOOPB', ['x'], 'LOOPC(x)').ok, true)
check('define LOOPC', define('LOOPC', ['x'], 'LOOPB(x)').ok, true)
check('indirect recursion -> #ERROR', cev('=LOOPB(1)'), '#ERROR')
check('indirect recursion from the other end', cev('=LOOPC(1)'), '#ERROR')
check('define SELFINSIDE', define('SELFINSIDE', ['x'], 'SUM(SELFINSIDE(x), 1)').ok, true)
check('recursion under a builtin -> #ERROR', cev('=SELFINSIDE(1)'), '#ERROR')
check('a good call still works after a cyclic one', cev('=SQFT(12, 12)'), 1)

console.log('\n-- call-time failures --')
check('too few arguments', cev('=SQFT(1)'), '#ERROR')
check('too many arguments', cev('=SQFT(1, 2, 3)'), '#ERROR')
check('undefined function', cev('=NOPE(1)'), '#ERROR')
check('zero-arg function called with an arg', cev('=WITHA1(1)'), '#ERROR')

console.log('\n-- definition-time validation --')
check('name collides with a builtin', defineError('SUM', ['x'], 'x'), 'SUM is a built-in function')
check('lowercase builtin collision', defineError('sum', ['x'], 'x'), 'SUM is a built-in function')
check('name already defined', defineError('SQFT', ['w', 'h'], 'w * h'), 'SQFT is already defined')
check(
  'overwrite is allowed explicitly',
  reg.define({ name: 'SQFT', params: ['w', 'h'], body: 'w * h / 144' }, { overwrite: true }).ok,
  true,
)
check('invalid name', defineError('2BAD', [], '1'), '"2BAD" is not a valid function name')
check('name that reads as a cell ref', defineError('B2', [], '1'), '"B2" would be read as a cell reference')
check('a digit-suffixed name that is not a cell is fine', defineError('SQFT2', [], '1'), '(accepted)')
check('empty name', defineError('', [], '1'), 'a function name is required')
check('duplicate parameters', defineError('DUP', ['a', 'a'], 'a'), 'duplicate parameter "a"')
check('parameter that reads as a cell ref', defineError('PBAD', ['b2'], 'b2'), '"b2" would be read as a cell reference')
check('unparseable body', defineError('BADBODY', [], '1 +'), 'the body is not a valid formula')
check('empty body', defineError('NOBODY', [], '   '), 'a function body is required')
check(
  'unknown identifier in body',
  defineError('UNKNOWN', ['x'], 'x + nosuchthing'),
  '"nosuchthing" is not a parameter or a column',
)
check(
  'A1 ref past the last column in body',
  defineError('OFFGRID', [], 'K1 + 1'),
  '"K" is not a column in this table',
)
check(
  'a parameter cannot take a row index',
  defineError('ROWPARAM', ['x'], 'x[2] + 1'),
  'parameter "x" cannot take a row reference',
)
check('a body may call a not-yet-defined function', defineError('FORWARD', ['x'], 'LATER(x)'), '(accepted)')
check('non-object definition', reg.define('nope').ok, false)

console.log('\n-- removal and registry bookkeeping --')
check('remove SQFT', reg.remove('sqft'), true)
check('dependent formula now errors', cev('=SQFT(12, 12)'), '#ERROR')
check('so does its caller', cev('=AREA(12)'), '#ERROR')
check('removing again is a no-op', reg.remove('SQFT'), false)
check('re-defining after removal works', define('SQFT', ['w', 'h'], 'w * h / 144').ok, true)
check('and the caller recovers', cev('=AREA(12)'), 1)
check('has() is case-insensitive', reg.has('sQfT'), true)
check('list() hands out copies', reg.list()[0] !== reg.list()[0], true)

let notified = 0
const unsubscribe = reg.subscribe(() => {
  notified++
})
const versionBefore = reg.version
define('NOTIFY', [], '1')
check('subscriber was notified', notified, 1)
check('version bumped', reg.version, versionBefore + 1)
unsubscribe()
reg.remove('NOTIFY')
check('unsubscribed listener is silent', notified, 1)

console.log('\n-- JSON round trip --')
const serialised = JSON.stringify(reg)
const restored = createFunctionRegistry()
const replaceResult = restored.replaceAll(JSON.parse(serialised))
check('replaceAll accepted the snapshot', replaceResult.ok, true)
check('same number of definitions', restored.list().length, reg.list().length)
check('same JSON both sides', JSON.stringify(restored), serialised)
check(
  'restored definitions still evaluate',
  evaluateFormula('=SQFT(12, 12)', { ...gctx(0), functions: restored }).ok,
  true,
)
check(
  'replaceAll rejects the whole batch on one bad entry',
  restored.replaceAll([{ name: 'OK1', params: [], body: '1' }, { name: 'SUM', params: [], body: '1' }]).ok,
  false,
)
check('...and leaves the live set untouched', restored.has('SQFT'), true)
check('replaceAll needs an array', restored.replaceAll('nope').ok, false)
check('clear empties the registry', (restored.clear(), restored.list().length), 0)

console.log('\n-- the shared registry needs no wiring --')
customFunctions.remove('TRIPLE')
check('define on the global registry', customFunctions.define({ name: 'TRIPLE', params: ['x'], body: 'x * 3' }).ok, true)
check('evaluateFormula picks it up with no context', gev('=TRIPLE(E1)'), 30)
check(
  'recalcFormulas picks it up too',
  recalcFormulas([{ age: 7, out: 0 as unknown }], { '0:out': '=TRIPLE(age)' })[0].out,
  21,
)
customFunctions.remove('TRIPLE')
check('and stops working once removed', gev('=TRIPLE(E1)'), '#ERROR')

/* ================================================ horizontal fill (Gap 1) == */

// What the grid does per filled cell: rows shift in data-index space, columns
// shift in A1 letter space (`columnDeltaBetween`), which is definition order
// and not the on-screen order.
const fillTranslate = (
  src: string,
  fromColumn: string,
  toColumn: string,
  rowDelta = 0,
) => translateFormula(src, rowDelta, columnDeltaBetween(fromColumn, toColumn))

console.log('\n-- column deltas in A1 letter space --')
check('age -> visits is +1', columnDeltaBetween('age', 'visits'), 1)
check('visits -> age is -1', columnDeltaBetween('visits', 'age'), -1)
check('avatar -> salary is +8', columnDeltaBetween('avatar', 'salary'), 8)
check('same column is 0', columnDeltaBetween('age', 'age'), 0)
check('unknown source column is 0', columnDeltaBetween('select', 'age'), 0)
check(
  'a combined column has no letter, so 0',
  columnDeltaBetween('age', 'merged:firstName+lastName'),
  0,
)
check(
  'columnIndexForId agrees with DATA_COLUMN_IDS',
  columnIndexForId('salary'),
  DATA_COLUMN_IDS.indexOf('salary'),
)
check('columnIndexForId is -1 off the list', columnIndexForId('nope'), -1)

console.log('\n-- filling a formula sideways --')
check('=E1*2 filled age -> visits', fillTranslate('=E1*2', 'age', 'visits'), '=F1 * 2')
check(
  '=E1*2 filled age -> progress (two columns right)',
  fillTranslate('=E1*2', 'age', 'progress'),
  '=H1 * 2',
)
// Nothing moved, so the author's exact text (spacing and all) is kept.
check(
  '=$E1*2 stays anchored to its column',
  fillTranslate('=$E1*2', 'age', 'progress'),
  '=$E1*2',
)
check(
  '=E$1 keeps its row and moves its column',
  fillTranslate('=E$1', 'age', 'visits'),
  '=F$1',
)
check(
  'filling left moves the column back',
  fillTranslate('=F1+1', 'visits', 'age'),
  '=E1 + 1',
)
check(
  'filling left clamps at column A',
  fillTranslate('=A1+1', 'salary', 'firstName'),
  '=A1+1',
)
check(
  'a clamped column still moves when the row does',
  fillTranslate('=A1+1', 'salary', 'firstName', 1),
  '=A2 + 1',
)
check(
  'a diagonal fill moves both halves',
  fillTranslate('=E1', 'age', 'visits', 2),
  '=F3',
)
check(
  'ranges move column by column',
  fillTranslate('=SUM(E1:E3)', 'age', 'visits'),
  '=SUM(F1:F3)',
)
// Column-name references have no column axis: `age` means "the age column",
// with nothing to shift it onto. Leaving them alone is the documented choice.
check(
  'a bare column-name ref is left alone sideways',
  fillTranslate('=age*2', 'age', 'visits'),
  '=age*2',
)
check(
  'an indexed column-name ref keeps its column too',
  fillTranslate('=age[3]', 'age', 'visits'),
  '=age[3]',
)
check(
  'but its row half still shifts on a diagonal fill',
  fillTranslate('=age[3]', 'age', 'visits', 2),
  '=age[5]',
)
check(
  'mixed notation: only the A1 half moves sideways',
  fillTranslate('=A1+age[1]', 'age', 'visits'),
  '=B1 + age[1]',
)
check(
  'an unknown target column leaves the formula put',
  fillTranslate('=E1*2', 'age', 'merged:firstName+lastName'),
  '=E1*2',
)

/* ==================================================== TSV clipboard (Gap 2) */

const tsv = (rows: string[][]) => JSON.stringify(rows)

console.log('\n-- TSV serialisation --')
check('plain grid', serializeTSV([['a', 'b'], ['c', 'd']]), 'a\tb\nc\td')
check('empty cells survive', serializeTSV([['', 'b']]), '\tb')
check('a tab forces quotes', serializeTSV([['a\tb']]), '"a\tb"')
check('a newline forces quotes', serializeTSV([['a\nb']]), '"a\nb"')
check('quotes are doubled', serializeTSV([['say "hi"']]), '"say ""hi"""')
check('an inch mark alone needs no quoting', serializeTSV([['5" pipe']]), '"5"" pipe"')
check('nothing to copy', serializeTSV([]), '')

console.log('\n-- TSV parsing --')
check('empty text is no rows', tsv(parseTSV('')), tsv([]))
check('single cell', tsv(parseTSV('a')), tsv([['a']]))
check('two by two', tsv(parseTSV('a\tb\nc\td')), tsv([['a', 'b'], ['c', 'd']]))
check('CRLF line endings', tsv(parseTSV('a\tb\r\nc\td')), tsv([['a', 'b'], ['c', 'd']]))
check('lone CR line endings', tsv(parseTSV('a\rb')), tsv([['a'], ['b']]))
check(
  'a trailing newline adds no phantom row',
  tsv(parseTSV('a\tb\nc\td\r\n')),
  tsv([['a', 'b'], ['c', 'd']]),
)
check('empty fields are kept', tsv(parseTSV('a\t\tb')), tsv([['a', '', 'b']]))
check(
  'a quoted field may contain a tab',
  tsv(parseTSV('"a\tb"\tc')),
  tsv([['a\tb', 'c']]),
)
check(
  'a quoted field may contain a newline',
  tsv(parseTSV('"line1\nline2"\tc')),
  tsv([['line1\nline2', 'c']]),
)
check(
  'doubled quotes come back as one',
  tsv(parseTSV('"say ""hi"""\tc')),
  tsv([['say "hi"', 'c']]),
)
check(
  'a quote mid-field is literal',
  tsv(parseTSV('5" pipe\tc')),
  tsv([['5" pipe', 'c']]),
)
check(
  'Excel-shaped payload',
  tsv(parseTSV('Ann\t30\r\nBob\t40\r\n')),
  tsv([['Ann', '30'], ['Bob', '40']]),
)

console.log('\n-- TSV round trips --')
const roundTrip = (rows: string[][]) => tsv(parseTSV(serializeTSV(rows)))
check('plain values', roundTrip([['a', 'b'], ['c', 'd']]), tsv([['a', 'b'], ['c', 'd']]))
check(
  'values with delimiters and quotes',
  roundTrip([['a\tb', 'say "hi"'], ['line1\nline2', '']]),
  tsv([['a\tb', 'say "hi"'], ['line1\nline2', '']]),
)
check('numbers as text', roundTrip([['1,234.50', '-7']]), tsv([['1,234.50', '-7']]))

/* ================================================== undo / redo (Gap 3) == */

console.log('\n-- history entries --')
const entry = makeEntry(
  'fill',
  [
    { rowIndex: 0, columnId: 'age', before: 10, after: 20 },
    // A no-op cell: the fill wrote what was already there.
    { rowIndex: 1, columnId: 'age', before: 5, after: 5 },
  ],
  [
    { key: '0:age', before: undefined, after: '=B1' },
    { key: '1:age', before: '=B2', after: '=B2' },
  ],
)
check('no-op cells are pruned', entry.cells.length, 1)
check('no-op formula patches are pruned', entry.formulas.length, 1)
check('an all-no-op entry is empty', isEmptyEntry(makeEntry('x', [], [])), true)

check(
  'undo writes the before values',
  JSON.stringify(cellWritesFor(entry, 'undo')),
  JSON.stringify([{ rowIndex: 0, columnId: 'age', value: 10 }]),
)
check(
  'redo writes the after values',
  JSON.stringify(cellWritesFor(entry, 'redo')),
  JSON.stringify([{ rowIndex: 0, columnId: 'age', value: 20 }]),
)

console.log('\n-- formula map patches --')
const baseMap: FormulaMap = { '3:age': '=E1' }
const added = applyFormulaPatch(
  baseMap,
  [{ key: '0:age', before: undefined, after: '=E1*2' }],
  'redo',
)
check('redo adds the formula', added['0:age'], '=E1*2')
check('the original map is untouched', '0:age' in baseMap, false)
check(
  'undo removes it again',
  '0:age' in
    applyFormulaPatch(
      added,
      [{ key: '0:age', before: undefined, after: '=E1*2' }],
      'undo',
    ),
  false,
)
check(
  'undo restores a replaced formula',
  applyFormulaPatch(
    { '3:age': '=E1+1' },
    [{ key: '3:age', before: '=E1', after: '=E1+1' }],
    'undo',
  )['3:age'],
  '=E1',
)
check(
  'an empty patch hands the same map back',
  applyFormulaPatch(baseMap, [], 'undo') === baseMap,
  true,
)
check(
  'a patch that changes nothing hands the same map back',
  applyFormulaPatch(baseMap, [{ key: '3:age', before: '=E1', after: '=E1' }], 'redo') ===
    baseMap,
  true,
)

console.log('\n-- applying a whole step, both halves --')
// A miniature of the real thing: a two-cell fill that wrote one formula, then
// undo, then redo. `data` and `formulas` have to move together.
type Cell = Record<string, unknown>
const rowsOf = (values: number[]): Cell[] => values.map((age) => ({ age }))

const applyWrites = (target: Cell[], writes: ReturnType<typeof cellWritesFor>) => {
  const next = target.map((row) => ({ ...row }))
  for (const write of writes) next[write.rowIndex][write.columnId] = write.value
  return next
}

let liveRows = rowsOf([10, 0, 0])
let liveFormulas: FormulaMap = {}

const fillStep = makeEntry(
  'fill',
  [
    { rowIndex: 1, columnId: 'age', before: 0, after: 20 },
    { rowIndex: 2, columnId: 'age', before: 0, after: 30 },
  ],
  [
    { key: '1:age', before: undefined, after: '=E1*2' },
    { key: '2:age', before: undefined, after: '=E1*3' },
  ],
)

liveRows = applyWrites(liveRows, cellWritesFor(fillStep, 'redo'))
liveFormulas = applyFormulaPatch(liveFormulas, fillStep.formulas, 'redo')
check('the fill wrote both cells', JSON.stringify(liveRows.map((r) => r.age)), '[10,20,30]')
check('and both formulas', Object.keys(liveFormulas).length, 2)

liveRows = applyWrites(liveRows, cellWritesFor(fillStep, 'undo'))
liveFormulas = applyFormulaPatch(liveFormulas, fillStep.formulas, 'undo')
check('undo restored the values', JSON.stringify(liveRows.map((r) => r.age)), '[10,0,0]')
check('undo restored the formula map too', Object.keys(liveFormulas).length, 0)

liveRows = applyWrites(liveRows, cellWritesFor(fillStep, 'redo'))
liveFormulas = applyFormulaPatch(liveFormulas, fillStep.formulas, 'redo')
check('redo puts it all back', JSON.stringify(liveRows.map((r) => r.age)), '[10,20,30]')
check('formulas too', liveFormulas['2:age'], '=E1*3')

console.log('\n-- stack capping --')
let stack: HistoryEntry[] = []
for (let i = 0; i < 60; i++) {
  stack = pushHistory(stack, makeEntry(`step ${i}`, [
    { rowIndex: i, columnId: 'age', before: 0, after: i + 1 },
  ], []), 50)
}
check('the stack is capped', stack.length, 50)
check('the oldest steps fell off', stack[0].label, 'step 10')
check('the newest step is on top', stack[stack.length - 1].label, 'step 59')
check('a zero limit keeps nothing', pushHistory([], entry, 0).length, 0)
check(
  'pushing does not mutate the input',
  (() => {
    const before: HistoryEntry[] = []
    pushHistory(before, entry, 5)
    return before.length
  })(),
  0,
)

/* --------------------------------------------------- circular references */

const circularRows = () => [
  { age: 1, visits: 2, salary: 3 },
  { age: 4, visits: 5, salary: 6 },
]

check(
  'a bare self reference is circular',
  findCircularKeys({ '0:age': '=age * 2' }).has('0:age'),
  true,
)

check(
  'an A1 self reference is circular',
  findCircularKeys({ '0:age': '=E1 * 2' }).has('0:age'),
  true,
)

check(
  'a formula reading another column is not circular',
  findCircularKeys({ '0:age': '=visits * 2' }).size,
  0,
)

check(
  'mutual references between two cells are circular',
  (() => {
    const found = findCircularKeys({
      '0:age': '=visits',
      '0:visits': '=age',
    })
    return found.has('0:age') && found.has('0:visits')
  })(),
  true,
)

check(
  'a range covering its own cell is circular',
  findCircularKeys({ '1:age': '=SUM(age[1]:age[3])' }).has('1:age'),
  true,
)

check(
  'a range below its own cell is not circular',
  findCircularKeys({ '0:age': '=SUM(age[2]:age[3])' }).size,
  0,
)

check(
  'a self-referential formula resolves to the circular marker',
  (recalcFormulas(circularRows(), { '0:age': '=age * 2' })[0] as any).age,
  ERROR_CIRCULAR,
)

check(
  'recalc settles: a second pass returns the same array reference',
  (() => {
    const formulas: FormulaMap = { '0:age': '=age * 2' }
    const once = recalcFormulas(circularRows(), formulas)
    return recalcFormulas(once, formulas) === once
  })(),
  true,
)

check(
  'non-circular formulas still evaluate alongside a circular one',
  (() => {
    const out = recalcFormulas(circularRows(), {
      '0:age': '=age * 2',
      '0:salary': '=visits * 10',
    })
    return (out[0] as any).salary
  })(),
  20,
)

/* ========================================== the live A1 letter space == */
//
// Everything above runs on the DEFAULT letter space (the built-in demo schema),
// which is what a headless caller gets. From here the space is driven the way
// the grid drives it, so these tests must stay LAST — `resetLetterSpace()` at
// the end of the file puts it back.

console.log('\n-- the blank-sheet bug (letters the engine never had) --')

// A blank sheet: six generic columns, exactly as `blankColumns` builds them.
const blank = dataColumnIdsFromDefs(blankColumns(6))
check('blankColumns gives col1..col6', blank.join(','), 'col1,col2,col3,col4,col5,col6')

// Register them the way the header's letter row does: one call per data column,
// left to right, positional index counting data columns only.
const registerHeaderRow = (ids: string[]) =>
  ids.forEach((id, index) => observeLetterColumn(id, index))

registerHeaderRow(blank)

check('a whole new schema replaces the space', getLetterSpace().join(','), blank.join(','))
check('C is the third column of THIS sheet', columnIdFromLetters('C'), 'col3')
check('and col3 draws a C in the header', lettersForColumnId('col3'), 'C')
check('F is col6', columnIdFromLetters('F'), 'col6')
check('G is past the end', columnIdFromLetters('G'), '')

// The reported repro, cell for cell: 1 in C2, 2 in C3, `=C2+C3` in F8.
const sheet: Record<string, unknown>[] = [
  { col1: '', col2: '', col3: '', col4: '', col5: '', col6: '' },
  { col1: '', col2: '', col3: 1, col4: '', col5: '', col6: '' },
  { col1: '', col2: '', col3: 2, col4: '', col5: '', col6: '' },
]
const sev = (src: string, row = 7) => {
  const result = evaluateFormula(src, {
    currentRow: row,
    getCell: (r: number, c: string) => sheet[r]?.[c],
  })
  return result.ok ? result.value : result.error
}

check('=C2+C3 on a blank sheet is 3, not 0', sev('=C2+C3'), 3)
check('=SUM(C2:C3)', sev('=SUM(C2:C3)'), 3)
check('=C2*10', sev('=C2*10'), 10)

console.log('\n-- an unresolvable A1 ref is an error, never a quiet 0 --')
check('letters past the last column', sev('=G1'), '#ERROR')
check('and in arithmetic, so it cannot hide', sev('=G1+C2'), '#ERROR')
check('a range running off the end', sev('=SUM(A1:G2)'), '#ERROR')
check('an empty cell inside the schema is still 0', sev('=C1'), 0)
// Named refs are unchanged: an unknown NAME has always read as empty.
check('an unknown column NAME still reads as empty', sev('=nosuchcolumn+1'), 1)

console.log('\n-- registration is append-only --')
// A hidden column is simply absent from the pass. Its letter must survive, or
// hiding one column would change what every formula after it computes.
registerHeaderRow(['col1', 'col2', 'col4', 'col5', 'col6'])
check('hiding col3 does not re-letter col4', lettersForColumnId('col4'), 'D')
check('and col3 keeps its C', columnIdFromLetters('C'), 'col3')

// A column added at runtime claims the next free letter, wherever it was
// inserted on screen.
registerHeaderRow(['col1', 'col7', 'col2', 'col3', 'col4', 'col5', 'col6'])
check('a new column claims the next letter', lettersForColumnId('col7'), 'G')
check('the existing letters are untouched', columnIdFromLetters('C'), 'col3')

// Nothing in the pass is a column we know: the schema was swapped wholesale.
registerHeaderRow(DATA_COLUMN_IDS)
check('a wholesale swap starts over', columnIdFromLetters('E'), 'age')
check('and drops the old sheet entirely', lettersForColumnId('col3'), '')

console.log('\n-- named references are untouched by any of this --')
check('=age is still the age column', gev('=age'), 10)
check('=age[3]', gev('=age[3]'), 30)
check('=age[$1] from row 2', gev('=age[$1]', 2), 10)
check('=age1 name+row', gev('=age1'), 10)
check('=SUM(age[1]:age[4])', gev('=SUM(age[1]:age[4])'), 100)
check('$E$1 absolute A1 still resolves', gev('=$E$1', 2), 10)
check('2-D A1 range still resolves', gev('=SUM(E1:F2)'), 330)

console.log('\n-- dataColumnIdsFromDefs --')
check(
  'walks groups and skips the select gutter',
  dataColumnIdsFromDefs([
    { id: 'select' },
    { header: 'Name', columns: [{ accessorKey: 'firstName' }, { id: 'lastName' }] },
    { kind: 'group', columns: [{ kind: 'leaf', id: 'age', accessorKey: 'age' }] },
  ]).join(','),
  'firstName,lastName,age',
)
check('non-arrays give nothing', dataColumnIdsFromDefs(null).length, 0)
check(
  'duplicates claim one letter each',
  dataColumnIdsFromDefs([{ id: 'a' }, { id: 'a' }, { id: 'b' }]).join(','),
  'a,b',
)

/* ============================== migrating formulas saved before the fix == */
//
// A v1 payload's letters were bound to the frozen demo list. Migration
// retranslates them through that old mapping onto the column they always meant,
// so the numbers a reloaded sheet shows are the numbers it showed before.

console.log('\n-- legacy A1 migration --')
const mig = (src: string) => migrateLegacyA1Formula(src, blank)

check('C2 meant lastName row 2', mig('=C2+C3'), '=lastName[2] + lastName[3]')
check('E1 meant age row 1', mig('=E1'), '=age[1]')
check('$E$1 keeps its absolute row', mig('=$E$1'), '=age[$1]')
check('E$1 keeps its absolute row', mig('=E$1'), '=age[$1]')
check('$E1 stays relative', mig('=$E1'), '=age[1]')
check('a one-column range becomes a named range', mig('=SUM(E1:E4)'), '=SUM(age[1]:age[4])')
check('mixed with a named ref', mig('=E1+age[2]'), '=age[1] + age[2]')
check('letters past the OLD space are left alone', mig('=Z1'), '=Z1')
check('a formula with no A1 refs is byte-identical', mig('=age[1]  +1'), '=age[1]  +1')
check('a plain value is not a formula', mig('42'), '42')
check('an unparseable formula passes through', mig('=((('), '=(((')

// A sheet still on the built-in schema means exactly what it always meant, so
// nothing is rewritten and nobody's `=E1` turns into `age[1]` for no reason.
check('the demo schema migrates to itself', migrateLegacyA1Formula('=E1+F2', DATA_COLUMN_IDS), '=E1+F2')
check(
  'even for ranges',
  migrateLegacyA1Formula('=SUM($E$1:$F$2)', DATA_COLUMN_IDS),
  '=SUM($E$1:$F$2)',
)

check(
  'a map with nothing to do comes back by identity',
  (() => {
    const m = { '0:x': '=E1', '1:x': '=age' }
    return migrateLegacyA1Formulas(m, DATA_COLUMN_IDS) === m
  })(),
  true,
)
check(
  'a map that changed comes back rewritten',
  JSON.stringify(migrateLegacyA1Formulas({ '7:col6': '=C2+C3' }, blank)),
  JSON.stringify({ '7:col6': '=lastName[2] + lastName[3]' }),
)

console.log('\n-- migration preserves the value, which is the whole point --')
// What the OLD engine did: letters resolved against the frozen demo list, so on
// a blank sheet they landed on demo ids the data has no key for — empty, 0.
const legacyValue = (src: string) => {
  setLetterSpace(DATA_COLUMN_IDS)
  const result = evaluateFormula(src, {
    currentRow: 7,
    getCell: (r: number, c: string) => sheet[r]?.[c],
  })
  return result.ok ? result.value : result.error
}
// What the NEW engine does with the migrated text, on the sheet's own letters.
const migratedValue = (src: string) => {
  setLetterSpace(blank)
  return sev(migrateLegacyA1Formula(src, blank))
}

for (const src of ['=C2+C3', '=SUM(E1:E4)', '=E1*2+1', '=ROUND(E1/3, 2)', '=C2']) {
  const before = legacyValue(src)
  check(`${src} computes the same before and after`, migratedValue(src), before)
}
// ...and the pre-fix reading of `=C2+C3` really was the bogus 0 this fixes.
check('the old answer was a silent 0', legacyValue('=C2+C3'), 0)

// A migrated formula is a named ref, so a fill still shifts it by the same rows.
setLetterSpace(blank)
check(
  'a migrated formula still fills',
  translateFormula(migrateLegacyA1Formula('=C2+C3', blank), 5),
  '=lastName[7] + lastName[8]',
)

// Leave the space as the rest of the suite (and any later import) expects.
resetLetterSpace()
check('the space resets to the built-in schema', columnIdFromLetters('E'), 'age')

/* ══════════════════════════════════════════════════ cross-sheet `@` scope ══ */
//
// A two-sheet workbook built by hand. `s1` and `s2` are the ids the engine
// keys cycles on; the NAMES are what a formula says. They are spelled WITHOUT
// a space here so the plain `@sheet1` form is what these cases exercise; the
// spaced, hyphenated, quoted and outright hostile names get their own section
// further down.

console.log('\n-- cross-sheet: names resolve the way a user would expect --')

check('case is folded', sheetNameKey('SHEET1'), 'sheet1')
// Inner whitespace is SIGNIFICANT, and these are the assertions that pin it:
// the greedy `@...(` scan can hold a space, so folding one out would make two
// tabs a user can plainly tell apart indistinguishable to `@`.
check('inner space is kept, not folded', sheetNameKey('Q1 Sales'), 'q1 sales')
check('inner runs are kept verbatim', sheetNameKey('Q1   Sales'), 'q1   sales')
check(
  '`Q1 Sales` and `Q1Sales` are DIFFERENT sheets',
  sheetNameKey('Q1 Sales') === sheetNameKey('Q1Sales'),
  false,
)
// The outer trim stays: the scan trims what it reads, and tab names are stored
// trimmed, so `@ Sheet1 (a1)` has to find `Sheet1`.
check('outer padding is trimmed', sheetNameKey('  Q1 Sales '), 'q1 sales')

type Sheet = {
  id: string
  name: string
  rows: Record<string, unknown>[]
  formulas: FormulaMap
}

const makeWorkbook = (sheets: Sheet[]) => {
  const lookup = (name: string): CrossSheetSheet | null => {
    const key = sheetNameKey(name)
    const hit = sheets.find((sheet) => sheetNameKey(sheet.name) === key)
    if (!hit) return null
    return {
      id: hit.id,
      formulas: hit.formulas,
      getCell: (rowIndex: number, columnId: string) => hit.rows[rowIndex]?.[columnId],
    }
  }
  return {
    lookup,
    // The evaluation context a formula ON `sheetId` runs in.
    ctxFor: (sheetId: string, row: number) => {
      const home = sheets.find((sheet) => sheet.id === sheetId)!
      return {
        currentRow: row,
        getCell: (r: number, c: string) => home.rows[r]?.[c],
        sheets: lookup,
      }
    },
    crossFor: (sheetId: string) => ({ sheetId, lookup }),
  }
}

// `col1`/`col2` rather than `age`/`visits`: a blank-sheet schema, so `a1`/`b1`
// have to travel through the A1 letter space to land anywhere.
const sheet1: Sheet = {
  id: 's1',
  name: 'Sheet1',
  rows: [
    { col1: 1, col2: 10 },
    { col1: 2, col2: 20 },
    { col1: 3, col2: 30 },
  ],
  formulas: {},
}
const sheet2: Sheet = {
  id: 's2',
  name: 'Sheet2',
  rows: [
    { col1: 100, col2: 1000 },
    { col1: 200, col2: 2000 },
    { col1: 300, col2: 3000 },
  ],
  formulas: {},
}
const book = makeWorkbook([sheet1, sheet2])
const blankSpace = ['col1', 'col2', 'col3', 'col4', 'col5', 'col6']
setLetterSpace(blankSpace)

// Evaluate a formula that lives on `sheetId`, at `row`.
const xev = (src: string, sheetId = 's2', row = 0) => {
  const result = evaluateFormula(src, book.ctxFor(sheetId, row))
  return result.ok ? result.value : result.error
}

console.log('\n-- cross-sheet: parsing and round-tripping --')

const round = (src: string) => {
  const ast = parseFormula(src)
  return ast ? stringifyFormula(ast) : null
}

check('the user\'s own example parses', round('=@sheet1(a1+b3)'), '=@sheet1(A1 + B3)')
check('a lone cross-sheet ref', round('=@sheet1(a1)'), '=@sheet1(A1)')
check('mixed local and cross arithmetic', round('=@sheet1(a1) + b2'), '=@sheet1(A1) + B2')
check('the name keeps the case it was typed in', round('=@ShEeT1(a1)'), '=@ShEeT1(A1)')
check('a range inside the scope', round('=SUM(@sheet1(a1:a3))'), '=SUM(@sheet1(A1:A3))')
check('a call inside the scope', round('=@sheet1(SUM(a1:a3))'), '=@sheet1(SUM(A1:A3))')
check('a whole expression stays inside the parens', round('=@sheet1(a1 + a2) * 2'), '=@sheet1(A1 + A2) * 2')
// The one that would silently change meaning if `emit` respected precedence.
check(
  'a low-precedence body is never unwrapped',
  round('=@sheet1(a1 + a2)'),
  '=@sheet1(A1 + A2)',
)
check('nested @ is rejected', parseFormula('=@sheet1(@sheet2(a1))'), null)
check('nested @ deeper in the body is rejected too', parseFormula('=@sheet1(1 + @sheet2(a1))'), null)
check('@ with no name is rejected', parseFormula('=@(a1)'), null)
check('@ with no parens is rejected', parseFormula('=@sheet1'), null)
check('@ with no body is rejected', parseFormula('=@sheet1()'), null)
check('@ taking two arguments is rejected', parseFormula('=@sheet1(a1, a2)'), null)
// `@` after a name is not a sheet scope and never was valid text.
check('a stray @ is still an error', parseFormula('=a1 @ b1'), null)

console.log('\n-- cross-sheet: evaluation --')

check('the whole scope resolves on the named sheet', xev('=@sheet1(a1+b3)'), 1 + 30)
check('a lone cross ref', xev('=@sheet1(a1)'), 1)
check('a lone local ref, for contrast', xev('=a1'), 100)
check('mixed: cross + local', xev('=@sheet1(a1) + b2'), 1 + 2000)
check('mixed: local + cross', xev('=a1 + @sheet1(a1)'), 100 + 1)
check('two scopes in one formula', xev('=@sheet1(a1) + @sheet2(a1)'), 1 + 100)
check('the name is matched case-insensitively', xev('=@SHEET1(a1)'), 1)
check('and with the space the tab name really has', xev('=@Sheet1(b2)'), 20)
check('a range inside the scope sums the OTHER sheet', xev('=SUM(@sheet1(a1:a3))'), 6)
check('the same range locally, for contrast', xev('=SUM(a1:a3)'), 600)
check('a builtin nested inside the scope', xev('=@sheet1(SUM(a1:a3))'), 6)
check('current-row refs use the caller\'s row', xev('=@sheet1(col1)', 's2', 2), 3)
check('arithmetic inside the scope', xev('=@sheet1(a1 * b1 + 5)'), 1 * 10 + 5)
check('a scope can be negated', xev('=-@sheet1(b3)'), -30)
check('a scope can be raised to a power', xev('=@sheet1(a2)^3'), 8)

console.log('\n-- cross-sheet: #REF! --')

check('an unknown sheet name', xev('=@nosuchsheet(a1)'), ERROR_REF)
check('unknown, mixed with a fine local ref', xev('=@nosuchsheet(a1) + b1'), ERROR_REF)
// A deleted sheet is exactly an unknown name: the registry no longer lists it,
// so the lookup that used to answer now returns null.
const afterDelete = makeWorkbook([sheet2])
check(
  'a DELETED sheet',
  (() => {
    const r = evaluateFormula('=@sheet1(a1)', {
      currentRow: 0,
      getCell: (row: number, col: string) => sheet2.rows[row]?.[col],
      sheets: afterDelete.lookup,
    })
    return r.ok ? r.value : r.error
  })(),
  ERROR_REF,
)
// The library build (`lib.tsx`) has no sheets and passes no resolver at all.
check(
  'no resolver at all degrades to #REF!, never a crash',
  (() => {
    const r = evaluateFormula('=@sheet1(a1)', {
      currentRow: 0,
      getCell: (row: number, col: string) => sheet2.rows[row]?.[col],
    })
    return r.ok ? r.value : r.error
  })(),
  ERROR_REF,
)
check(
  'and the local half of such a host is untouched',
  (() => {
    const r = evaluateFormula('=a1 + 1', {
      currentRow: 0,
      getCell: (row: number, col: string) => sheet2.rows[row]?.[col],
    })
    return r.ok ? r.value : r.error
  })(),
  101,
)

console.log('\n-- cross-sheet: circular references --')

// sheet1!0:col1 = @sheet2(a1)  and  sheet2!0:col1 = @sheet1(a1).
// Neither evaluation recurses (each reads the other's STORED rows), so this
// cannot hang — the risk is a confident, stale number, which is what the
// cross-sheet graph exists to replace with `#CIRCULAR!`.
const cyc1: Sheet = {
  id: 's1',
  name: 'Sheet1',
  rows: [{ col1: 0 }],
  formulas: { '0:col1': '=@sheet2(a1)' },
}
const cyc2: Sheet = {
  id: 's2',
  name: 'Sheet2',
  rows: [{ col1: 0 }],
  formulas: { '0:col1': '=@sheet1(a1)' },
}
const cycBook = makeWorkbook([cyc1, cyc2])

check(
  'a two-sheet cycle is found from sheet 1',
  findCircularKeys(cyc1.formulas, cycBook.crossFor('s1')).has('0:col1'),
  true,
)
check(
  'and from sheet 2',
  findCircularKeys(cyc2.formulas, cycBook.crossFor('s2')).has('0:col1'),
  true,
)
check(
  'the recalc marks it, rather than showing a stale number',
  (recalcFormulas(
    cyc1.rows as Record<string, unknown>[],
    cyc1.formulas,
    undefined,
    undefined,
    cycBook.crossFor('s1'),
  )[0] as Record<string, unknown>)['col1'],
  ERROR_CIRCULAR,
)

// A THREE-sheet cycle: s1 → s2 → s3 → s1. The graph has to keep following `@`
// through sheets it only learned about by walking, not from the caller.
const three = [
  { id: 's1', name: 'One', rows: [{ col1: 0 }], formulas: { '0:col1': '=@two(a1)' } },
  { id: 's2', name: 'Two', rows: [{ col1: 0 }], formulas: { '0:col1': '=@three(a1)' } },
  { id: 's3', name: 'Three', rows: [{ col1: 0 }], formulas: { '0:col1': '=@one(a1)' } },
] satisfies Sheet[]
const threeBook = makeWorkbook(three)
check(
  'a three-sheet cycle is found',
  findCircularKeys(three[0].formulas, threeBook.crossFor('s1')).has('0:col1'),
  true,
)

// The near miss: two sheets pointing at each other's DIFFERENT cells is not a
// cycle, and must still compute.
const ok1: Sheet = {
  id: 's1',
  name: 'Sheet1',
  rows: [{ col1: 7, col2: 0 }],
  formulas: { '0:col2': '=@sheet2(a1)' },
}
const ok2: Sheet = {
  id: 's2',
  name: 'Sheet2',
  rows: [{ col1: 9, col2: 0 }],
  formulas: { '0:col2': '=@sheet1(a1)' },
}
const okBook = makeWorkbook([ok1, ok2])
check(
  'crossing references that do not close a loop are NOT circular',
  findCircularKeys(ok1.formulas, okBook.crossFor('s1')).size,
  0,
)
check(
  'and they compute',
  (recalcFormulas(
    ok1.rows as Record<string, unknown>[],
    ok1.formulas,
    undefined,
    undefined,
    okBook.crossFor('s1'),
  )[0] as Record<string, unknown>)['col2'],
  9,
)

// A self-reference reached THROUGH another sheet's name — `@thisSheet(…)`
// written on the sheet it names — is an ordinary same-sheet cycle and must not
// escape detection just because it went round the `@`.
const selfRef: Sheet = {
  id: 's1',
  name: 'Sheet1',
  rows: [{ col1: 0 }],
  formulas: { '0:col1': '=@sheet1(a1)' },
}
const selfBook = makeWorkbook([selfRef])
check(
  'a scope naming its OWN sheet still closes the loop',
  findCircularKeys(selfRef.formulas, selfBook.crossFor('s1')).has('0:col1'),
  true,
)

// Without a cross context the old single-sheet behaviour is exactly preserved.
check(
  'no cross context: an @ formula is simply not a cycle',
  findCircularKeys(cyc1.formulas).size,
  0,
)
check(
  'no cross context: an ordinary cycle is still caught',
  findCircularKeys({ '0:col1': '=col1' }).has('0:col1'),
  true,
)

console.log('\n-- cross-sheet: highlighting inputs --')

const resolve = (name: string) =>
  sheetNameKey(name) === 'sheet1' ? 's1' : sheetNameKey(name) === 'sheet2' ? 's2' : null

check(
  'a local ref carries no sheet',
  JSON.stringify(extractReferences('=a1', 0, resolve)),
  JSON.stringify([{ columnId: 'col1', dataRow: 0 }]),
)
check(
  'a cross ref carries the sheet it lands on',
  JSON.stringify(extractReferences('=@sheet1(a1)', 0, resolve)),
  JSON.stringify([{ columnId: 'col1', dataRow: 0, sheetId: 's1' }]),
)
check(
  'a mixed formula reports both, distinctly',
  JSON.stringify(extractReferences('=@sheet1(a1) + a1', 0, resolve)),
  JSON.stringify([
    { columnId: 'col1', dataRow: 0, sheetId: 's1' },
    { columnId: 'col1', dataRow: 0 },
  ]),
)
check(
  'an unresolvable @ highlights nothing at all',
  extractReferences('=@nosuchsheet(a1)', 0, resolve).length,
  0,
)
check(
  'no resolver: the @ body is skipped, never flattened onto the local sheet',
  extractReferences('=@sheet1(a1) + b1', 0).length,
  1,
)
check(
  'a cross range reports every cell, all on the other sheet',
  extractReferences('=@sheet1(a1:a3)', 0, resolve).every((r) => r.sheetId === 's1'),
  true,
)

console.log('\n-- cross-sheet: fill translation leaves the scope alone --')

check(
  'the local half shifts, the cross half does not',
  translateFormula('=@sheet1(a1) + b2', 3),
  '=@sheet1(A1) + B5',
)
check(
  'a formula that is ONLY a scope comes back byte-identical',
  translateFormula('=@sheet1(a1)', 3),
  '=@sheet1(a1)',
)
check(
  'a range inside a scope is left alone too',
  translateFormula('=SUM(@sheet1(a1:a3)) + b1', 2),
  '=SUM(@sheet1(A1:A3)) + B3',
)

console.log('\n-- cross-sheet: renaming a tab rewrites the formulas --')

check(
  'the reference follows the rename',
  renameSheetInFormula('=@sheet1(a1)', 'Sheet1', 'Budget'),
  '=@Budget(A1)',
)
check(
  'however it was spelled',
  renameSheetInFormula('=@SHEET1(a1) + @Sheet1(b1)', 'Sheet1', 'Budget'),
  '=@Budget(A1) + @Budget(B1)',
)
// A space in the new name is now simply KEPT — the whole point of the greedy
// scan. It used to come back as `@Q1Sales`, a name the user never chose.
check(
  'a new name with a space stays spelled the way the tab is',
  renameSheetInFormula('=@sheet1(a1)', 'Sheet1', 'Q1 Sales'),
  '=@Q1 Sales(A1)',
)
check(
  'and it resolves back to that tab, unlike its space-free twin',
  [
    sheetNameKey('Q1 Sales') === sheetNameKey('Q1 Sales'),
    sheetNameKey('Q1Sales') === sheetNameKey('Q1 Sales'),
  ].join(','),
  'true,false',
)
// Renaming ACROSS the two forms, in both directions. This is the case that
// silently broke every dependent formula before quoting existed.
check(
  'a rename into a name that needs quotes gets them',
  renameSheetInFormula('=@sheet1(a1)', 'Sheet1', "Bob's (old) Data"),
  "=@'Bob''s (old) Data'(A1)",
)
check(
  'a rename OUT of a quoted name drops them again',
  renameSheetInFormula("=@'Bob''s (old) Data'(a1)", "Bob's (old) Data", 'Budget'),
  '=@Budget(A1)',
)
check(
  'a formula that spelled the old name quoted is found too',
  renameSheetInFormula("=@'Sheet1'(a1)", 'Sheet1', 'Budget'),
  '=@Budget(A1)',
)
check(
  'and one that spelled a spaced name bare',
  renameSheetInFormula('=@Q1 Sales(a1)', 'Q1 Sales', "Bob's Data"),
  "=@Bob's Data(A1)",
)
check(
  'a rename to nothing is not a rename, and rewrites nothing',
  renameSheetInFormula('=@sheet1(a1)', 'Sheet1', '   '),
  '=@sheet1(a1)',
)
check(
  'a reference to a DIFFERENT sheet is untouched',
  renameSheetInFormula('=@sheet2(a1)', 'Sheet1', 'Budget'),
  '=@sheet2(a1)',
)
check(
  'a formula with no @ is handed back byte-identical',
  renameSheetInFormula('=a1  +   b1', 'Sheet1', 'Budget'),
  '=a1  +   b1',
)
check(
  'a non-formula is handed back byte-identical',
  renameSheetInFormula('plain text with an @ in it', 'Sheet1', 'Budget'),
  'plain text with an @ in it',
)
check(
  'an unparseable formula is handed back byte-identical',
  renameSheetInFormula('=@sheet1((( ', 'Sheet1', 'Budget'),
  '=@sheet1((( ',
)
check(
  'a map with nothing to rewrite comes back by identity',
  (() => {
    const map: FormulaMap = { '0:col1': '=a1+1' }
    return renameSheetInFormulas(map, 'Sheet1', 'Budget') === map
  })(),
  true,
)
check(
  'a map that changed comes back rewritten',
  JSON.stringify(
    renameSheetInFormulas({ '0:col1': '=@sheet1(a1)' }, 'Sheet1', 'Budget'),
  ),
  JSON.stringify({ '0:col1': '=@Budget(A1)' }),
)
// The whole point of the rewrite: the value survives the rename.
check(
  'the renamed formula computes what it did before',
  (() => {
    const renamedBook = makeWorkbook([
      { ...sheet1, name: 'Budget' },
      sheet2,
    ])
    const src = renameSheetInFormula('=@sheet1(a1+b3)', 'Sheet1', 'Budget')
    const r = evaluateFormula(src, {
      currentRow: 0,
      getCell: (row: number, col: string) => sheet2.rows[row]?.[col],
      sheets: renamedBook.lookup,
    })
    return r.ok ? r.value : r.error
  })(),
  31,
)
// ...and without the rewrite it would NOT — this is the regression the rewrite
// exists to prevent, asserted rather than assumed.
check(
  'an un-rewritten formula would have broken',
  (() => {
    const renamedBook = makeWorkbook([{ ...sheet1, name: 'Budget' }, sheet2])
    const r = evaluateFormula('=@sheet1(a1+b3)', {
      currentRow: 0,
      getCell: (row: number, col: string) => sheet2.rows[row]?.[col],
      sheets: renamedBook.lookup,
    })
    return r.ok ? r.value : r.error
  })(),
  ERROR_REF,
)

/* ═════════════════════════════════ a sheet may be called anything at all ══ */
//
// The rule used to be that a tab name had to be a formula IDENTIFIER, because
// `@name(` tokenized one. That restricted the user's data to suit the app's
// grammar, and it is gone. The grammar changed instead:
//
//   BARE    everything between the `@` and the FIRST `(`, trimmed.
//   QUOTED  `@'…'(` for the one thing the scan cannot hold — a `(` in the name
//           — with `''` standing for a literal quote.
//
// This section is the proof, so it uses names nobody would choose: hyphens,
// spaces, apostrophes, a leading digit, unicode, unbalanced parens, and the
// hostile string the design was stress-tested with.

console.log('\n-- names: anything but empty and duplicate --')

const WILD = [
  { id: 'w1', name: 'Q1-Sales', rows: [{ col1: 11 }], formulas: {} },
  { id: 'w2', name: 'Q1 Sales', rows: [{ col1: 22 }], formulas: {} },
  { id: 'w3', name: "Bob's Data", rows: [{ col1: 33 }], formulas: {} },
  { id: 'w4', name: '2024', rows: [{ col1: 44 }], formulas: {} },
  { id: 'w5', name: 'Ventes Q1 — Été', rows: [{ col1: 55 }], formulas: {} },
  { id: 'w6', name: 'Q1(a1)', rows: [{ col1: 66 }], formulas: {} },
  { id: 'w7', name: '@@@q1!@@sa((kle)((sdf', rows: [{ col1: 77 }], formulas: {} },
  { id: 'w8', name: "Bob's (old) Data", rows: [{ col1: 88 }], formulas: {} },
  { id: 'w9', name: 'Q1Sales', rows: [{ col1: 99 }], formulas: {} },
] satisfies Sheet[]
const wild = makeWorkbook(WILD)
const wev = (src: string) => {
  const r = evaluateFormula(src, {
    currentRow: 0,
    getCell: () => undefined,
    sheets: wild.lookup,
  })
  return r.ok ? r.value : r.error
}

// The headline case. `@Q1-Sales(a1)` used to parse cleanly as "sheet `Q1`,
// minus the call `Sales(a1)`" and hand back a confident wrong number; the
// greedy scan makes it mean the only thing it can mean.
check('a hyphen is part of the name, not a minus', wev('=@Q1-Sales(a1)'), 11)
check('a space is part of the name too', wev('=@Q1 Sales(a1)'), 22)
check('and is NOT interchangeable with no space', wev('=@Q1Sales(a1)'), 99)
check('an apostrophe mid-name needs no quoting', wev("=@Bob's Data(a1)"), 33)
check('a name that is all digits', wev('=@2024(a1)'), 44)
check('unicode, accents and an em dash', wev('=@Ventes Q1 — Été(a1)'), 55)
check('padding around the name is trimmed off', wev('=@   Q1-Sales   (a1)'), 11)
check('the name is still matched case-insensitively', wev('=@q1-SALES(a1)'), 11)

// The quoted form: the same sheets, and the ones the bare form cannot reach.
check('quoting a name that did not need it changes nothing', wev("=@'Q1 Sales'(a1)"), 22)
check('a name holding parens, reachable only quoted', wev("=@'Q1(a1)'(a1)"), 66)
check(
  'a doubled quote is one literal quote',
  wev("=@'Bob''s (old) Data'(a1)"),
  88,
)
check(
  'the hostile name, end to end',
  wev("=@'@@@q1!@@sa((kle)((sdf'(a1)"),
  77,
)

console.log('\n-- names: the bare/quoted grammar itself --')

// `@name` is ONLY ever a scope, and a scope requires a parenthesised body. So
// `@Q1` can never stand alone as a term, and there is nothing for a following
// `-` to subtract from — which is exactly why scanning greedily to the first
// `(` cannot get any formula wrong. Someone who means the subtraction writes
// this, and the scan still yields `Q1`.
check(
  'sheet-minus-call is written with the body, and still parses that way',
  round('=@Q1(a1) - Sales(b1)'),
  '=@Q1(A1) - SALES(B1)',
)
check(
  'the bare name wins whenever it resolves, hint or no hint',
  (() => {
    const both = makeWorkbook([
      ...WILD,
      { id: 'wq', name: 'Q1', rows: [{ col1: 1234 }], formulas: {} },
    ])
    const r = evaluateFormula('=@Q1(a1)', {
      currentRow: 0,
      getCell: () => undefined,
      sheets: both.lookup,
    })
    return r.ok ? r.value : r.error
  })(),
  1234,
)
// Nothing is guessed: the wider reading only picks the ERROR CODE.
check(
  'a truncated `(` name says #QUOTE!, not an unexplainable #REF!',
  wev('=@Q1(a1)'),
  ERROR_QUOTE,
)
check(
  'an ordinary typo is still a plain #REF!',
  wev('=@nosuchsheet(a1)'),
  ERROR_REF,
)
check(
  'and so is a truncation whose wider reading names nothing either',
  wev('=@Q1(b1)'),
  ERROR_REF,
)

check('an unterminated quote is a parse error', parseFormula("=@'Q1 Sales(a1)"), null)
check('...and is never truncated into a name', parseFormula("=@'Q1 Sales(a1)") === null, true)
check('an empty quoted name is rejected', parseFormula("=@''(a1)"), null)
check('a quoted name with no body is rejected', parseFormula("=@'Q1 Sales'"), null)
check('junk between the close quote and the body is rejected', parseFormula("=@'Q1' x(a1)"), null)
check('a bare name with no body is rejected', parseFormula('=@Q1 Sales'), null)
check('a bare name that is only padding is rejected', parseFormula('=@   (a1)'), null)

console.log('\n-- names: bare vs quoted emission --')

// Bare whenever the name survives the greedy scan byte-for-byte; quoted
// otherwise. `spell` goes in through the always-legal quoted form so the
// stringifier is the only thing choosing.
const spell = (name: string) => {
  const ast = parseFormula(`=@'${name.replace(/'/g, "''")}'(a1)`)
  return ast ? stringifyFormula(ast) : null
}

check('a plain identifier stays bare', spell('Sheet1'), '=@Sheet1(A1)')
check('a space does not need quotes any more', spell('Q1 Sales'), '=@Q1 Sales(A1)')
check('nor does a hyphen', spell('Q1-Sales'), '=@Q1-Sales(A1)')
check('nor a leading digit', spell('2024'), '=@2024(A1)')
check('nor unicode', spell('Ventes Q1 — Été'), '=@Ventes Q1 — Été(A1)')
check('nor an apostrophe that is not leading', spell("Bob's Data"), "=@Bob's Data(A1)")
check('a `(` forces quotes', spell('Q1(a1)'), "=@'Q1(a1)'(A1)")
check(
  'and a quote inside a quoted name is doubled',
  spell("Bob's (old) Data"),
  "=@'Bob''s (old) Data'(A1)",
)
check(
  'a LEADING quote forces quotes, or the reader would eat it',
  spell("'quoted'"),
  "=@'''quoted'''(A1)",
)
check('outer padding forces quotes, because the scan would trim it', spell(' pad '), "=@' pad '(A1)")
check('the hostile name is quoted', spell('@@@q1!@@sa((kle)((sdf'), "=@'@@@q1!@@sa((kle)((sdf'(A1)")

check('isBareSheetName agrees with what was emitted', [
  isBareSheetName('Sheet1'),
  isBareSheetName('Q1 Sales'),
  isBareSheetName("Bob's Data"),
  isBareSheetName('Q1(a1)'),
  isBareSheetName("'quoted'"),
  isBareSheetName(' pad '),
  isBareSheetName(''),
].join(','), 'true,true,true,false,false,false,false')

// THE invariant: whatever is emitted, re-parsing it names the SAME sheet.
// Anything less and a rename or a fill quietly repoints a formula.
const NAME_SET = [
  'Sheet1',
  'Q1 Sales',
  'Q1-Sales',
  '2024',
  "Bob's Data",
  "Bob's (old) Data",
  'Ventes Q1 — Été',
  'Q1(a1)',
  "'quoted'",
  ' pad ',
  '@@@q1!@@sa((kle)((sdf',
  "it's a '(' problem",
  ')unbalanced(',
  '@',
  "''",
]
for (const name of NAME_SET) {
  check(
    `round trip: ${JSON.stringify(name)}`,
    (() => {
      const src = `=@${sheetRefText(name)}(a1)`
      const once = parseFormula(src)
      if (!once || once.kind !== 'sheet' || once.name !== name) return `parse: ${src}`
      const again = parseFormula(stringifyFormula(once))
      return again && again.kind === 'sheet' ? again.name : `reparse: ${src}`
    })(),
    name,
  )
}

console.log('\n-- names: the overlay lexes a quoted name as ONE token --')

const wildResolve = (name: string) =>
  WILD.find((sheet) => sheetNameKey(sheet.name) === sheetNameKey(name))?.id ?? null
const whl = (src: string) =>
  highlightFormula(src, { resolveSheet: wildResolve, columnsOfSheet: () => ['col1'] })
const wkind = (src: string, text: string) =>
  whl(src).find((token) => token.text === text)?.kind ?? 'missing'

for (const src of [
  "=@'Q1 Sales'(a1)",
  '=@Q1-Sales(a1) + 1',
  "=@'Bob''s (old) Data'(a1)",
  "=@'Q1 Sa",
  '=@Q1 Sal',
  "=@''(a1)",
  '=@@@@q1!@@sa((kle)((sdf(a1)',
]) {
  check(`overlay reassembles ${JSON.stringify(src)}`, whl(src).map((t) => t.text).join(''), src)
}

check('a quoted name is one token, quotes included', wkind("=@'Q1 Sales'(a1)", "@'Q1 Sales'"), 'sheet')
check('a bare name with a space is one token too', wkind('=@Q1 Sales(a1)', '@Q1 Sales'), 'sheet')
check('a hyphenated one is not split at the minus', wkind('=@Q1-Sales(a1)', '@Q1-Sales'), 'sheet')
check(
  'the doubled quote stays inside the token',
  wkind("=@'Bob''s (old) Data'(a1)", "@'Bob''s (old) Data'"),
  'sheet',
)
// A draft the parser would refuse must not read as "understood".
check('an unterminated quote is never coloured', wkind("=@'Q1 Sales", "@'Q1 Sales"), 'plain')
check('a name that resolves to nothing stays plain', wkind('=@nope(a1)', '@nope'), 'plain')
check(
  'a resolved scope still checks its refs against THAT sheet',
  wkind("=@'Q1 Sales'(a1)", 'a1'),
  'ref',
)

check(
  'the truncated-at-a-paren case is flagged, not just left grey',
  wkind('=@Q1(a1)', '@Q1'),
  'sheet-quote',
)
check(
  'but only when the wider reading really names a tab',
  wkind('=@Q1(b1)', '@Q1'),
  'plain',
)
check(
  'and never over a name that resolved on its own',
  wkind('=@Q1-Sales(a1)', '@Q1-Sales'),
  'sheet',
)

console.log('\n-- names: the registry and the resolver agree on what collides --')

// `uniqueSheetName` decides which names may COEXIST; `sheetNameKey` decides
// which names `@` can TELL APART. If those two ever disagree, a workbook can
// hold two sheets one reference resolves to arbitrarily — the exact bug
// uniqueness exists to prevent — so this asserts they are the same function.
const REG: SheetInfo[] = [
  { id: 'r1', name: 'Data' },
  { id: 'r2', name: 'Q1 Sales' },
]
check('an exact duplicate is suffixed', uniqueSheetName('Data', REG), 'Data2')
check('a case-variant duplicate is too, because @ folds case', uniqueSheetName('DATA', REG), 'DATA2')
check(
  'a space-free twin is NOT a duplicate, because @ no longer folds space',
  uniqueSheetName('Q1Sales', REG),
  'Q1Sales',
)
check('renaming a sheet to its own name is not a clash', uniqueSheetName('Data', REG, 'r1'), 'Data')
check(
  'every name the registry allows side by side resolves distinctly',
  (() => {
    const kept: SheetInfo[] = []
    for (const raw of ['Data', 'DATA', 'Q1 Sales', 'Q1Sales', ' Data ', '2024']) {
      kept.push({ id: `k${kept.length}`, name: uniqueSheetName(normalizeSheetName(raw, 'x'), kept) })
    }
    return new Set(kept.map((sheet) => sheetNameKey(sheet.name))).size === kept.length
  })(),
  true,
)

// The relaxed name rules: trim and clamp, and nothing else.
check('a space survives normalisation now', normalizeSheetName('Q1 Sales', 'x'), 'Q1 Sales')
check('so does a hyphen', normalizeSheetName('Q1-Sales', 'x'), 'Q1-Sales')
check('a leading digit is no longer prefixed', normalizeSheetName('2024', 'x'), '2024')
check('unicode is left alone', normalizeSheetName('Ventes Q1 — Été', 'x'), 'Ventes Q1 — Été')
check('parens survive too, and the quoted form can reach them', normalizeSheetName('Q1(a1)', 'x'), 'Q1(a1)')
check('the hostile name survives whole', normalizeSheetName('@@@q1!@@sa((kle)((sdf', 'x'), '@@@q1!@@sa((kle)((sdf')
check('padding is still trimmed', normalizeSheetName('   Q1 Sales   ', 'x'), 'Q1 Sales')
check('empty still falls back', normalizeSheetName('   ', 'Sheet 1'), 'Sheet 1')
check('a non-string still falls back', normalizeSheetName(null, 'Sheet 1'), 'Sheet 1')
check('the length clamp still bites, and leaves no trailing padding', normalizeSheetName(`${'a'.repeat(59)}   tail`, 'x'), 'a'.repeat(59))
check('the default name has its space back', DEFAULT_SHEET_NAME, 'Sheet 1')

console.log('\n-- cross-sheet: nothing that used to parse changed meaning --')

// `@` was a tokenizer error before, so no stored formula can contain one; and
// every pre-`@` form still round-trips and evaluates identically.
for (const src of ['=age*2', '=SUM(age[1]:age[4])', '=E1+F2', '=ROUND(age/3, 2)']) {
  resetLetterSpace()
  check(`${src} still round-trips`, round(src), round(src))
}
setLetterSpace(blankSpace)
check('SUM is still the builtin, not a sheet', xev('=SUM(a1:a2)'), 300)
check('a sheet may even be NAMED sum without shadowing it', parseFormula('=@sum(a1)') !== null, true)

console.log('\n-- cross-sheet: the editor overlay tokens --')

// The contract the whole overlay rests on: the spans put back together are the
// input, character for character. Break it and the colours slide out from under
// the text in the <input> sitting on top.
setLetterSpace(blankSpace)
const hl = (src: string) =>
  highlightFormula(src, { resolveSheet: resolve, columnsOfSheet: () => ['col1', 'col2'] })
const kindOf = (src: string, text: string) =>
  hl(src).find((token) => token.text === text)?.kind ?? 'missing'

for (const src of [
  '=@sheet1(a1+b3)',
  '=@sheet1( a1 ) + b2',
  '=SUM(a1:a3) * 2',
  '=@sheat1(a1)',
  '=@',
  '=',
  '=@sheet1(',
  '=  a1   +  ',
  '=$E$1 + age[2]',
  '=1.5 + .5',
  '=~!weird`',
]) {
  check(`overlay reassembles ${JSON.stringify(src)}`, hl(src).map((t) => t.text).join(''), src)
}

check('a resolving @name is a sheet token', kindOf('=@sheet1(a1)', '@sheet1'), 'sheet')
check('a mis-typed @name is NOT', kindOf('=@sheat1(a1)', '@sheat1'), 'plain')
check('case does not matter to the highlight either', kindOf('=@SHEET1(a1)', '@SHEET1'), 'sheet')
check('a real column highlights as a ref', kindOf('=a1', 'a1'), 'ref')
check('a nonexistent column does not', kindOf('=zz9', 'zz9'), 'plain')
check('a function name is its own kind', kindOf('=SUM(a1:a2)', 'SUM'), 'func')
check('a number is its own kind', kindOf('=1 + a1', '1'), 'number')
check(
  'inside a scope, refs are checked against THAT sheet',
  kindOf('=@sheet1(a1)', 'a1'),
  'ref',
)
check(
  'a column the other sheet does not have stays plain',
  highlightFormula('=@sheet1(c1)', {
    resolveSheet: resolve,
    columnsOfSheet: () => ['col1', 'col2'],
  }).find((t) => t.text === 'c1')?.kind,
  'plain',
)
check(
  'the scope closes at its own paren, so a later ref is local again',
  highlightFormula('=@sheet1(a1) + a1', {
    resolveSheet: resolve,
    columnsOfSheet: () => [],
  }).filter((t) => t.text === 'a1').length,
  2,
)
check('a non-formula draft is one plain run', hl('hello @sheet1').length, 1)
check('an empty draft is no tokens at all', hl('').length, 0)

resetLetterSpace()
check('the space resets again for anything downstream', columnIdFromLetters('E'), 'age')

console.log(`\n${passed} passed, ${failed} failed\n`)
