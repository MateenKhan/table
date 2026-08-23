// ─────────────────────────────────────────────────────────────────────────────
// formulaHighlight.ts — colouring the formula while it is being typed.
//
// The user asked for `@sheet1` to be "highlighted when understood as the
// sheet", and the same for cells. The word doing the work there is UNDERSTOOD:
// the highlight is not decoration, it is FEEDBACK. A token is coloured when it
// resolves to something real and left plain when it does not, so the absence of
// colour is the message — `@sheat1` stays grey and the user can see the typo
// without committing the cell and reading `#REF!` afterwards.
//
// ── Why this is not the parser ──────────────────────────────────────────────
//
// `formula.ts`'s tokenizer is the wrong tool three times over. It throws on the
// first unknown character (a draft is a half-typed string; throwing means no
// colour at all while you are mid-word), it discards whitespace and offsets (an
// overlay has to reproduce the input character for character or the text
// underneath it will not line up), and it only answers "is this valid", not
// "which SPAN is which kind". So this is a separate, total, position-preserving
// lexer whose one contract is:
//
//     tokens.map(t => t.text).join('') === src        // always, for any input
//
// Break that and the overlay drifts out of register with the real <input>.
//
// ── Resolution ──────────────────────────────────────────────────────────────
//
// `@name` colours as a sheet only when `resolveSheet(name)` says a tab by that
// name exists. A cell token colours only when it names a column that exists —
// and INSIDE a resolved `@name(…)` scope it is checked against THAT sheet's
// columns, because that is the sheet it will be read from. When the other
// sheet's columns cannot be established the check falls back to the live
// schema, which is a guess, but a permissive one: it may colour a token that
// turns out to be empty, and never greys out one that is fine.
// ─────────────────────────────────────────────────────────────────────────────

import {
  columnIdFromLetters,
  isKnownColumnId,
  letterSpaceLength,
  lettersToIndex,
} from './columnOrder'

export type HighlightKind =
  /** `@sheet1`, and only when that sheet exists. */
  | 'sheet'
  /**
   * `@Q1(` where no sheet is called `Q1` but one IS called `Q1(a1)` — the name
   * the greedy scan cut short at the `(`. The reference is wrong, but it is
   * wrong in a way with a specific fix (quote the name), and saying so while
   * the user is still typing beats a `#QUOTE!` after they commit.
   */
  | 'sheet-quote'
  /** A cell/column reference that resolves: `a1`, `age`, `$E$2`, `age[3]`. */
  | 'ref'
  /** A function name immediately followed by `(`. */
  | 'func'
  | 'number'
  | 'operator'
  /** Everything else, including tokens that did NOT resolve. */
  | 'plain'

export type HighlightToken = { text: string; kind: HighlightKind }

export type HighlightOptions = {
  /** `@name` → sheet id, or null when there is no such sheet. */
  resolveSheet?: (name: string) => string | null
  /** Column ids of a named sheet, for checking refs inside its scope. */
  columnsOfSheet?: (name: string) => string[] | null
}

const isDigit = (c: string) => c >= '0' && c <= '9'
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r'
const isIdentStart = (c: string) =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_'
const isIdentPart = (c: string) => isIdentStart(c) || isDigit(c)

const OPERATORS = '+-*/^(),:[]$@'

/**
 * The overlay's copy of `formula.ts`'s `readSheetName`, with one deliberate
 * difference: it never throws. A draft is half-typed by definition — `=@'Q1 Sa`
 * and `=@Q1 Sales` are both on the way to something valid — and the lexer's
 * contract is that every character comes back out, so a name the parser would
 * reject is reported as `name: null` (colour it plain) rather than abandoning
 * the rest of the line.
 *
 * `end` is the offset just past the name: at the `(` for a complete reference,
 * at the end of the input for a draft that has not reached one yet.
 */
function scanSheetName(
  src: string,
  at: number,
): { name: string | null; end: number; wider?: string } {
  let j = at + 1
  while (j < src.length && isSpace(src[j])) j++

  if (src[j] === "'") {
    let k = j + 1
    let name = ''
    for (;;) {
      // Unterminated: the parser calls this an error, so the overlay must not
      // colour it as understood — take the text, report no name.
      if (k >= src.length) return { name: null, end: k }
      if (src[k] === "'") {
        if (src[k + 1] === "'") {
          name += "'"
          k += 2
          continue
        }
        k++
        break
      }
      name += src[k]
      k++
    }
    return { name: name || null, end: k }
  }

  // Bare: everything up to the first `(`, or to the end of a draft that has not
  // typed one yet. Trimmed, exactly as the parser trims it.
  let k = j
  while (k < src.length && src[k] !== '(') k++
  return {
    name: src.slice(j, k).trim() || null,
    end: k,
    wider: widerName(src, at, k),
  }
}

/**
 * The name a QUOTED reference would have had: `@` to the body's matching `)`.
 * Mirrors `formula.ts`'s function of the same name — the overlay's whole job is
 * to say what the parser will do, so the two have to answer identically.
 */
function widerName(src: string, at: number, open: number): string | undefined {
  if (src[open] !== '(') return undefined
  let depth = 0
  for (let k = open; k < src.length; k++) {
    if (src[k] === '(') depth++
    else if (src[k] === ')') {
      depth--
      if (depth === 0) {
        const wider = src.slice(at + 1, k + 1).trim()
        return wider.includes('(') ? wider : undefined
      }
    }
  }
  return undefined
}

// The same two shapes `formula.ts`'s parser recognises, kept in step with it by
// hand. A divergence here is cosmetic (a token colours when it should not, or
// the reverse), never a wrong VALUE — the engine remains the only thing that
// decides what a formula means.
const A1_COMBINED = /^([A-Za-z]{1,7})([0-9]{1,7})$/
const NAME_ROW = /^([A-Za-z_][A-Za-z0-9_]*?)(\d+)$/

/**
 * Does `text` name a cell/column that exists in `columns`?
 *
 * `columns` null means "use the live letter space" — the schema of the sheet
 * being edited. A concrete list means "check against this other sheet", in
 * which case A1 letters are resolved positionally against that list rather than
 * through the live space, because the letters mean that sheet's Nth column.
 */
function refResolves(text: string, columns: string[] | null): boolean {
  if (columns) {
    const known = (id: string) => columns.includes(id)
    if (known(text)) return true
    const nameRow = NAME_ROW.exec(text)
    if (nameRow && known(nameRow[1])) return true
    const a1 = A1_COMBINED.exec(text)
    if (a1) {
      const index = lettersToIndex(a1[1])
      return index >= 0 && index < columns.length
    }
    return false
  }

  if (isKnownColumnId(text)) return true
  const nameRow = NAME_ROW.exec(text)
  if (nameRow && isKnownColumnId(nameRow[1])) return true
  const a1 = A1_COMBINED.exec(text)
  if (a1) {
    const index = lettersToIndex(a1[1])
    return index >= 0 && index < letterSpaceLength() && !!columnIdFromLetters(a1[1])
  }
  return false
}

/**
 * Split a formula draft into coloured spans. Total: any string in, spans out,
 * concatenating back to exactly the input. Non-formula text (no leading `=`)
 * comes back as one `plain` token so the caller can render it unchanged.
 */
export function highlightFormula(
  src: string,
  options: HighlightOptions = {},
): HighlightToken[] {
  if (!src.trimStart().startsWith('=')) return src ? [{ text: src, kind: 'plain' }] : []

  const out: HighlightToken[] = []
  const push = (text: string, kind: HighlightKind) => {
    if (!text) return
    // Merge runs of the same kind so the overlay makes as few <span>s as it can.
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }

  // The sheet whose columns references are currently checked against: null for
  // the sheet being edited, a name for inside a resolved `@name(…)`, and the
  // depth counter that closes the scope again at its matching `)`.
  let scopeName: string | null = null
  let scopeDepth = 0
  let columnsCache: string[] | null = null

  let i = 0
  while (i < src.length) {
    const c = src[i]

    if (isSpace(c)) {
      let j = i
      while (j < src.length && isSpace(src[j])) j++
      push(src.slice(i, j), 'plain')
      i = j
      continue
    }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1] ?? ''))) {
      let j = i
      while (j < src.length && isDigit(src[j])) j++
      if (src[j] === '.') {
        j++
        while (j < src.length && isDigit(src[j])) j++
      }
      push(src.slice(i, j), 'number')
      i = j
      continue
    }

    // `@name` — the whole thing, sigil and quotes included, is ONE token so it
    // colours (or does not) as a single unit. Highlighting the `@` while the
    // name stayed grey would read as "understood", which is the opposite of the
    // truth; and a name is now a run of arbitrary characters (`@Q1 Sales(`),
    // so splitting it into idents and operators would shred it into a dozen
    // differently-coloured pieces.
    if (c === '@') {
      const scanned = scanSheetName(src, i)
      const name = scanned.name
      const resolved = name ? (options.resolveSheet?.(name) ?? null) : null
      // Not resolved, but the name only got cut short at a `(` that belongs to
      // the SHEET's name? Say so distinctly. Grey would be honest but useless
      // here — the reference names a real tab, it is only spelled in the one
      // way this grammar cannot read.
      const needsQuotes =
        !resolved && !!scanned.wider && !!options.resolveSheet?.(scanned.wider)
      push(
        src.slice(i, scanned.end),
        resolved ? 'sheet' : needsQuotes ? 'sheet-quote' : 'plain',
      )
      const j = scanned.end
      if (resolved) {
        // Everything up to the matching `)` is read on that sheet. Tracked by
        // depth rather than by re-parsing, so an unbalanced draft (`=@s(a1`)
        // simply keeps the scope open to the end of the line instead of
        // giving up on colour entirely.
        scopeName = name
        columnsCache = null
        scopeDepth = 0
      }
      i = j
      continue
    }

    if (isIdentStart(c)) {
      let j = i
      while (j < src.length && isIdentPart(src[j])) j++
      const text = src.slice(i, j)
      // A name immediately followed by `(` is a call, not a reference —
      // exactly the rule the parser uses.
      let k = j
      while (k < src.length && isSpace(src[k])) k++
      if (src[k] === '(') {
        push(text, 'func')
        i = j
        continue
      }
      if (scopeName && columnsCache === null) {
        columnsCache = options.columnsOfSheet?.(scopeName) ?? null
      }
      push(text, refResolves(text, scopeName ? columnsCache : null) ? 'ref' : 'plain')
      i = j
      continue
    }

    if (OPERATORS.includes(c) || c === '=') {
      if (scopeName) {
        if (c === '(') scopeDepth++
        else if (c === ')') {
          scopeDepth--
          if (scopeDepth <= 0) {
            scopeName = null
            columnsCache = null
          }
        }
      }
      // `$` anchors belong to the reference they sit on, so they take the
      // reference colour rather than the operator one.
      push(c, c === '$' ? 'ref' : 'operator')
      i++
      continue
    }

    // Anything the lexer does not know — a stray character in a half-typed
    // draft. Kept verbatim and uncoloured; dropping it would misalign the
    // overlay, which is worse than showing it grey.
    push(c, 'plain')
    i++
  }

  return out
}
