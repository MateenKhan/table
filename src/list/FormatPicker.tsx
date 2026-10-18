import type { ListView } from './types'
import { useLabels } from './labelsContext'
import { applyPreset, matchPreset, presetLabel, presetsFor } from './formatPresets'

type Props = { view: ListView; columnId: string; label: string }

export function FormatPicker({ view, columnId, label }: Props) {
  const labels = useLabels()
  const kind = view.kindOf(columnId)
  if (!kind) return null
  const base = view.baseFormatOf(columnId) ?? ({ kind } as const)
  const presets = presetsFor(kind)
  const user = view.userFormatOf(columnId)
  const selected = user ? matchPreset(kind, user) || matchPreset(user.kind, user) : ''
  return (
    <select
      className="jtl-select jtl-select--format"
      aria-label={labels.format(label)}
      value={selected}
      onChange={(event) => {
        const preset = presets.find((entry) => entry.id === event.target.value)
        view.setFormat(columnId, preset ? applyPreset(base, preset) : undefined)
      }}
    >
      <option value="">{labels.formatDefault}</option>
      {presets.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {presetLabel(base, preset, view.options, labels)}
        </option>
      ))}
    </select>
  )
}
