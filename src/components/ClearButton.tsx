import { Eraser } from 'lucide-react'
import { useCellSelection } from '../useCellSelection'
import Tooltip from '../ui/Tooltip'
import { useConfirm } from '../ui'

// Clear the CONTENTS of the current selection — a standalone amber eraser that
// leads the toolbar's action row, ahead of Save (see ACTION_PRIORITY in
// ActionsRow). Rendered only when something is selected — the toolbar's own
// `scope: 'selection'` filter says the same thing, and this guard stays because
// it is what makes the component safe to drop anywhere, not just there — and it
// confirms through the shared dialog before wiping, so it never lives in two
// places or fires without asking.
export default function ClearButton() {
  const selection = useCellSelection()
  const confirm = useConfirm()

  if (!selection || selection.selectionScope.kind === 'none') return null

  const clear = async () => {
    const ok = await confirm({
      title: 'Clear contents',
      message: 'Clear the contents of the selected cells?',
      confirmLabel: 'Clear',
      tone: 'danger',
    })
    if (ok) selection.clearSelection()
  }

  return (
    <Tooltip label="Clear contents (Del)">
      <button
        type="button"
        className="icon-btn-sm border border-amber-200 text-amber-600 sm:hover:bg-amber-50"
        aria-label="Clear contents"
        onClick={clear}
      >
        <Eraser size={14} aria-hidden="true" />
      </button>
    </Tooltip>
  )
}
