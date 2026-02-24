export function PencilIcon() {
  return (
    <svg aria-hidden="true" className="icon-svg" viewBox="0 0 24 24">
      <path
        d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L17.5 5a2.1 2.1 0 0 0-3 0L4 15.5V20z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="m13.5 6 4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function FunnelIcon() {
  return (
    <svg aria-hidden="true" className="icon-svg" viewBox="0 0 24 24">
      <path
        d="M3 5h18l-7 8v5l-4 2v-7L3 5z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export function EllipsisIcon() {
  return (
    <svg aria-hidden="true" className="icon-svg" viewBox="0 0 24 24">
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </svg>
  )
}

type ChevronIconProps = {
  open?: boolean
}

export function ChevronIcon({ open = false }: ChevronIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={`icon-svg${open ? ' icon-rotated' : ''}`}
      viewBox="0 0 24 24"
    >
      <path
        d="m7 10 5 5 5-5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
