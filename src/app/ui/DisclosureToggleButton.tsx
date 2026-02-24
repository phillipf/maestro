import { ChevronIcon } from './ActionIcons'

type DisclosureToggleButtonProps = {
  controlsId: string
  expanded: boolean
  label: string
  onToggle: () => void
  className?: string
}

export function DisclosureToggleButton({
  controlsId,
  expanded,
  label,
  onToggle,
  className = 'btn btn-secondary icon-btn',
}: DisclosureToggleButtonProps) {
  const actionLabel = `${expanded ? 'Collapse' : 'Expand'} ${label}`

  return (
    <button
      aria-controls={controlsId}
      aria-expanded={expanded}
      aria-label={actionLabel}
      className={className}
      onClick={onToggle}
      title={actionLabel}
      type="button"
    >
      <ChevronIcon open={expanded} />
    </button>
  )
}
