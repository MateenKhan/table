import { RotateCcw, Trash2 } from 'lucide-react'
import Tooltip from '../ui/Tooltip'
import { useConfirm } from '../ui'

// The two whole-sheet lifecycle actions — Reload (throw the sheet away and
// rebuild it from its source data) and Delete all (throw the sheet away and
// leave a blank one). They live side by side in the toolbar, immediately after
// Save, because the user thinks of them as one cluster: write it out, read it
// back fresh, start over.
//
// ── Why both confirm, and why the two dialogs are written to differ ──────────
// This file replaces `DangerActions`, whose "Restore table" called the SAME
// handler the always-visible Reload icon did — so the app offered one action
// twice, once fenced behind a confirm and once not, and the unfenced copy sat
// one pixel away from Save. A mis-click on Reload discards the sheet the user
// just saved, with no undo: `refreshData` clears the saved copy, drops every
// formula, empties the undo history and releases every uploaded file.
//
// Both are therefore confirmed, and the two dialogs are deliberately NOT
// near-identical: three adjacent icons where two of them destroy the sheet is
// only safe if the dialog tells you which one you hit. They differ in title, in
// the first sentence, in the itemised blast radius, and in the confirm button's
// label — "Reload data" vs "Delete everything".
//
// ── Both act on the ACTIVE SHEET ONLY ───────────────────────────────────────
// Since tabs landed, "the sheet" is one tab, not the whole app — and the word
// these two dialogs lean on hardest is exactly the word that changed meaning.
// "Delete everything" over a toolbar that now sits under a strip of tabs reads
// as "delete every sheet", which is a very different thing to agree to. Both
// dialogs therefore SAY which sheet they mean and say that the others are
// untouched. Deleting a whole sheet is a separate action with a separate
// confirm, on the tab itself (see SheetTabs).

type ReloadProps = {
  /** Rebuilds the sheet from its source data. Not undoable. */
  onReload: () => void
  /**
   * True when a Reload also wipes the copy of the sheet saved in this browser
   * (the standalone app). A library embed has no saved copy, so promising to
   * delete one would be a lie — the dialog drops that line instead.
   */
  clearsSavedSheet?: boolean
}

export function ReloadButton({ onReload, clearsSavedSheet }: ReloadProps) {
  const confirm = useConfirm()

  const reload = async () => {
    const ok = await confirm({
      title: 'Reload this sheet',
      message:
        'Discard the sheet in the current tab and load its original data again? The columns and rows come back as they started — this is not a blank sheet.',
      details: [
        'Only the sheet you are looking at is affected — your other tabs are untouched',
        ...(clearsSavedSheet
          ? ['This sheet’s saved copy in this browser is deleted, including your last Save']
          : []),
        'Every cell edit since the data was loaded is lost',
        'Formulas, uploaded files and the undo history are cleared',
      ],
      confirmLabel: 'Reload data',
      tone: 'danger',
    })
    if (ok) onReload()
  }

  return (
    <Tooltip label="Reload this sheet — discard it and load its original data">
      <button
        type="button"
        className="icon-btn-sm border border-sky-200 text-sky-600 sm:hover:bg-sky-50"
        aria-label="Reload data"
        onClick={reload}
      >
        <RotateCcw size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}

type DeleteAllProps = {
  /** Wipes to a blank sheet with generic columns. Not undoable. */
  onDeleteAll: () => void
}

export function DeleteAllButton({ onDeleteAll }: DeleteAllProps) {
  const confirm = useConfirm()

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Empty this sheet',
      message:
        'Delete every row AND every column in the current tab, leaving a blank sheet to start again in? Unlike Reload, nothing comes back — not even the original data.',
      details: [
        'Only the sheet you are looking at is emptied — your other tabs are untouched',
        'Every row is emptied and this sheet is left blank',
        'Your columns and their headers are replaced with unnamed ones',
        'Formulas, formatting, merges, column types and uploaded files are dropped',
      ],
      confirmLabel: 'Empty this sheet',
      tone: 'danger',
    })
    if (ok) onDeleteAll()
  }

  return (
    // Rose at rest, not just on hover: the destructive affordance has to be
    // visible while the user is deciding — especially now that this button
    // neighbours two benign ones and can no longer rely on a "Danger" caption
    // above it to say what it is.
    <Tooltip label="Empty this sheet — wipe this tab to a blank sheet">
      <button
        type="button"
        className="icon-btn-sm icon-btn-danger border border-rose-300"
        aria-label="Empty this sheet"
        onClick={deleteAll}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
