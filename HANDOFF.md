# HANDOFF — `@jugaaadi/table`

Written 2026-08-24. This is the single handoff for this package; extend it in
place rather than starting another.

Read this before touching multi-sheet, the toolbar, or the formula engine. The
non-obvious parts below are all things that were got wrong once and fixed, and
several of them are invisible until a specific second condition exists.

---

## 1. What this repo is, and where it sits

`@jugaaadi/table` v0.0.1 — a React data grid, published to npm, and consumed by
the showcase site at `public.jugaaadi.com`.

It is a **git submodule** of `jugaaadi-public`, checked out at
`packages/table`. That has three consequences people get wrong:

- Editing files here edits *this* repo. A commit in the parent records only a
  40-char pointer to a commit here — never file contents.
- **Push here before pushing the parent.** A parent pointing at a commit that
  only exists on one machine breaks everyone else's `git submodule update` with
  `reference is not a tree`.
- The showcase installs this package **from npm**, not from the submodule. The
  only source-linked package is `ai-providers` (see the alias block in
  `apps/showcase/vite.config.ts`). So a change here is invisible on the site
  until it is published *and* the dependency is bumped.

Full release order:

```bash
cd packages/table
git add -A && git commit -m "..." && git push        # 1. GitHub
npm version patch && npm publish                     # 2. npm  (no CI does this)
git push --follow-tags
cd ../..
# 3. bump "@jugaaadi/table" in apps/showcase/package.json, then:
npm install
git add packages/table package-lock.json apps/showcase/package.json && git commit
```

`^0.0.1` does **not** auto-upgrade to `0.0.2` — npm pins the patch for `0.0.x`
versions. Step 3's manual edit is mandatory.

---

## 2. Current state

| | |
|---|---|
| Branch | `main`, pushed |
| Last commits | `2b9e5da` fast-uri bump · `91b99e3` tabs + toolbar |
| Uncommitted | cross-sheet `@` formula references + sheet-name validation |
| Published | **no** — npm still has 0.0.1 without any of this |

Uncommitted files: `src/crossSheet.ts`, `src/formulaHighlight.ts` (both new),
and edits to `App.tsx`, `EditableCell.tsx`, `SheetTabs.tsx`, `formula.ts`,
`formula.test.ts`, `formulaRefs.ts`, `sheetRegistry.ts`, `index.css`.

### Verifying

There is **no `test` script** and no test runner installed. Tests are
dependency-free files run directly:

```bash
npx tsx src/formula.test.ts          # 561 passed
npx tsx src/formulaPointing.test.ts  #  78 passed
npx tsx src/globalSearch.test.ts     # 168 passed
npx tsx src/fillSeries.test.ts       #  68 passed
npx tsc --noEmit                     # must be exit 0
npm run build                        # vite build, ~45s cold
```

`src/columnDrag.test.ts` and `src/columnOrder.test.ts` **cannot run** — they
`import from 'vitest'`, which is not a dependency. Pre-existing; do not treat
their failure as a regression you caused.

---

## 3. Multi-sheet — the part most likely to be broken by accident

Each tab is a fully independent sheet. Per-sheet state lives in **four
module-level singletons plus a view store**, each keyed by sheet id:

| Store | Key base |
|---|---|
| `formatting.ts` → `tableFormatting` | `tableFormatting` |
| `columnTypeOverrides.ts` → `columnTypeOverrides` | `tableColumnTypeOverrides` |
| `columnMerge.tsx` | `tableColumnMerges` |
| `sheetPersistence.ts` (rows/cols/formulas) | `tt.customSheet.v1` |
| `sheetView.ts` (order/sizing/visibility/…) | `tt.sheetView.v1` |
| `sheetRegistry.ts` (the tab list) | `tt.sheets.v1` |

`sheetScopedKey(base, id)` returns **`base` for the first sheet** and
`base:id` for every other. That aliasing *is* the migration from the pre-tabs
format: sheet `s1` reads the keys where existing data already sits, so nothing
is copied and it cannot half-succeed. `s1` is reserved forever; ids come from a
persisted `nextOrdinal` that only increases, so a deleted sheet's id is never
reused.

### The trap

`resolveFormat()` is a free function read from `CustomTable`'s render hot path.
Sheets are **not** instances threaded through context — switching *re-aims the
singletons*. `pointStoresAtSheet()` and `eraseSheetStorage()` in `App.tsx` are
**two halves of one list**. Add a fifth per-sheet store to one without the
other and you either leak a deleted sheet's bytes forever or bleed them into
the next sheet. Both functions carry a comment saying so.

**This bug is invisible until a second sheet has content.** Verify any change
here by putting formatting, a column type and a column width on sheet 1, then
checking sheet 2 renders clean and sheet 1 is intact on return.

Switching is `capture → flush → re-aim → hydrate` (`moveActiveSheet`). Two
subtleties already fixed, easy to reintroduce:

- `useSheet` flushes only `if (this.loaded)`. Persisting a never-read store
  writes its empty map over the outgoing sheet's saved formatting.
- `useSheet` ends in `notify()`, **not** `ensureLoaded()` — the latter
  early-returns on an empty key *before* `syncStyleSheet()`, leaving the
  previous sheet's `<style>` element still painting.

### Deliberate behaviours, not bugs

- Switching away flushes via `saveSheetNow`, bypassing the autosave's
  `isCustomSchema` gate. Without it, tabbing off a demo-seeded sheet and
  reloading loses it. Consequence: that sheet returns as a custom sheet instead
  of re-seeding the demo. Same one-way door `explicitSheetSave.ts` documents.
- Undo history clears on switch — its stacks are keyed to the outgoing sheet's
  row indices.
- Column filters, the global query and `importedColumns` are session-only. A
  resurrected forgotten filter reads as data loss.
- Tabs are gated on `standalone && !activeVertical`. Library embeds
  (`lib.tsx` passes `standalone={false}`) and profile verticals run on the
  single fixed namespace, byte-identical to pre-tabs.

### Known gap

**Export/import is active-sheet-only.** `AppSnapshot` is a versioned format at
**v2** with share links and `.json` files already in the wild. Multi-sheet is a
v3 change, and the blocking question is not technical: *opening a 3-sheet file
when you have 5 open — replace, append, or merge by name?* Each answer is wrong
for someone and none can be undone. `snapshot.ts` already migrates v1 on read,
so a v3 that reads v2 as "one sheet" is clean when someone decides.

---

## 4. Cross-sheet formula references (`@`)

`@name(expr)` evaluates `expr` against another sheet. It is a **scope**, not a
cell reference: in `=@Sheet1(a1+b3)` *both* `a1` and `b3` resolve on Sheet1,
while `=@Sheet1(a1) + b2` mixes Sheet1's A1 with the current sheet's B2.

### The name-scanning rule

> The sheet name is every character between the `@` that opens the scope and
> the **first `(` after it**, trimmed.

Nothing between them is special — not `-`, `@`, `!`, `)`, spaces, digits or
unicode. Only `(` stops the scan.

```
=@Q1-Sales(a1)         → "Q1-Sales"
=@Q1 Sales(a1)         → "Q1 Sales"
=@ Sheet1 (a1)         → "Sheet1"       (trimmed)
=@Sheet1(SUM(a1:a3))   → "Sheet1"       (body parens are fine)
```

**Why first `(` and not last:** last would swallow the name into the body —
`=@Sheet1(SUM(a1:a3))` would read as `Sheet1(SUM`. Bodies contain parens
constantly; names rarely do.

**Why not a longest-match-that-resolves fallback** (try later `(`s until a name
resolves): it makes `parseFormula` depend on the sheet registry, so the same
formula text would parse to a *different AST* depending on which sheets exist.
Renaming a sheet would silently change stored formulas' shape, and
`translateFormula` and the cycle detector would become registry-dependent too.

**Quoted form** is the escape hatch, for names containing `(`, starting with
`'`, or with meaningful outer padding. Excel's convention; a literal `'` is
doubled:

```
=@'Sales(EU)'(a1)      → "Sales(EU)"
=@'Bob''s Data'(a1)    → "Bob's Data"
```

`stringifyFormula` emits **bare iff** the name survives the greedy scan
byte-for-byte (no `(`, no leading `'`, `name.trim() === name`), quoted
otherwise. The invariant, asserted over 15 hostile names: re-parsing emitted
text resolves to the same sheet.

### Sheet-name validation — exactly two rules

**Non-empty** and **unique**. No character is blocked. This was wrong twice
before: names were first restricted to `[A-Za-z_][A-Za-z0-9_]*`, then to
"anything but `(`". Both restricted user data to work around the grammar. The
grammar was fixed instead. **Do not reintroduce a charset restriction.**

`sheetNameKey` is `name.trim().toLowerCase()` — case-insensitive, **inner
whitespace significant** (`Q1 Sales` ≠ `Q1Sales`). `sheetRegistry.ts` imports
the engine's copy rather than defining its own, so `uniqueSheetName`'s
collision key and the resolver's are literally the same function. If they ever
diverge you can create two sheets `@` cannot tell apart.

### Recalc and cycles

Live for the sheet you are on; deferred for inactive ones. That is sound, not a
compromise: **only the active sheet is editable**, so the only writer of an
inactive sheet's bytes is the tab switch that made it inactive, which already
invalidates the cache. Not covered: a second browser tab mutating the same
localStorage — a pre-existing property of every store here.

Cross-sheet reads hit already-computed stored rows and never re-enter the
evaluator, so a cycle cannot hang; the risk was a confident stale number.
`findCircularKeys` keys the graph on `<sheetId> <cellKey>` and walks `@`
transitively, bounded by `MAX_CYCLE_NODES = 4000`.

Rename rewrites `@oldname` across all three tiers — React state, session stash,
and every other sheet's localStorage payload — switching between bare and
quoted spelling as needed. Delete needs no rewriting: the name stops resolving
and the formula yields `#REF!`.

`translateFormula` deliberately leaves `@` refs unshifted. Fill deltas are
measured on the sheet being edited; the other sheet's geometry did not change.
So filling `=@sheet1(a1) + b2` down moves `b2→b3` while `@sheet1(a1)` pins.

### Unfinished

`#QUOTE!` fires when a bare name fails *and* a quoted reading would have
worked. The error plumbing carries **only a code string** — `recalcFormulas`
writes it straight into the cell — so there is no channel for a sentence or the
corrected spelling. Showing `@'Q1(a1)'(a1)` as a suggestion needs a per-cell
diagnostics map threaded through recalc and the cell renderer.

---

## 5. Toolbar and layout

`ACTION_PRIORITY` in `ActionsRow.tsx` is the **single** ordering. Reordering
that array retunes the toolbar; no JSX at the call site encodes order.

**There is no expand/collapse chevron at desktop widths, on purpose.** The old
one rendered with nothing behind it and *hid* the peek to show a byte-identical
copy of the same four buttons — it never gave the grid a pixel. The collapse
toggle that exists now lives on the **sheets row** and trades the whole chrome
band for table rows, which is the only thing a toggle up there can honestly
buy. Do not merge the two concepts back together.

**Two different breakpoints, deliberately:**

- `lg` (1024px) — where two columns stop fitting side by side. Below it the
  query takes a line and the actions take the next at full width.
- `md` (768px) — where one full-width line stops fitting every action. Below
  it, four actions stay inline and the rest fold behind `⋮`.

Between them (the 768–1023 tablet band) the layout is stacked **and** everything
is inline. That is the point. They look redundant; they are not. The
`NARROW_QUERY` doc comment warns against "tidying" them into one.

Wrapping is plain CSS `flex-wrap` — the browser decides what fits. There is no
measuring pass, so it **cannot oscillate**. `OverflowGroups.tsx` documents the
feedback loop that shape of code caused (content shrinks → auto-sized container
shrinks → more room reported → content grows). Do not reintroduce a measure →
relayout → re-measure cycle here.

**The ops rail reserves no height at any width.** It used to, so the grid could
not jump when a selection appeared — but it shares a line with the 36px search
box, so reserving 64px put an empty band above *and* below it on every screen
with no selection. Selecting now moves the grid's top edge once. If that ever
proves worse than the hole, the fix is **not** to restore the reservation — it
is to make the strip no taller than the 36px line it sits on. Its height comes
from `ControlGroup` drawing its caption above the border, not from its buttons.

Sizing: `icon-btn-sm` is 32px (`control-sm` token), glyphs 14px. `icon-btn`
(44px touch) survives only in the attachment lightbox.

---

## 6. Click-away deselect

`useCellSelection.tsx` clears the selection on document `pointerdown` (capture
phase, so `stopPropagation` cannot disable it).

The test is `closest('table')`, **not** the scroll container. The whitespace
right of the last column and below the last row is inside the container but
outside the table, and it is usually the largest click target on screen —
exempting the container made clicking it do nothing.

Three exemptions, all necessary because these act *on* the selection and
clearing it on pointerdown would destroy what the click was for:

- `[data-keeps-selection]` — toolbar and sheets row
- `[data-popover-portal]` — colour/border/format panels, `⋮` menus (portalled
  to `<body>`, so not inside the toolbar in the DOM)
- `[role="dialog"]` — `Modal`, and every confirm. *"Clear the contents of 4
  cells?"* must still have those 4 cells when answered.

Inert spots **inside** the table opt back in with `data-clears-selection`
(non-data header cells, the trailing spacer beside the add-column `+`).

---

## 7. Conventions

- Block comments above non-obvious decisions explain **why**, usually citing
  the bug that motivated them. Several comments here are the only record of a
  fixed bug. If you change the code, update the comment — do not leave one
  describing code that no longer exists.
- Tailwind config loads once at startup: editing `tailwind.config.js` needs a
  dev-server restart, not HMR.
- `src/ui/Tooltip.tsx` is vendored and marked "do NOT diverge".
- Destructive actions confirm through `useConfirm`, with wording that
  distinguishes them. Reload and Delete-all sit adjacent and destroy different
  things; the dialog is what tells you which you hit.

## 8. Dependabot

7 alerts, **none reaching consumers**: `files: ["dist"]` publishes built output
only, and the ten runtime dependencies have zero alerts. `nanoid` ← `postcss`
and `fast-uri` ← `api-extractor` are dev-only; `image-size`, `serialize-
javascript` and `uuid` come from `website/` (Docusaurus, `private: true`).

Dependabot PRs here regenerate the **whole** lockfile in a different
environment. PR #3 was +367/−40 and dropped `@emotion/is-prop-valid`, which
`framer-motion` needs — that surfaces later as a broken `npm ci`, not as a
merge conflict. Prefer a targeted `npm update <pkg>` on current `main`; that is
what `2b9e5da` did.
