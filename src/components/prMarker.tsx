// PR marker: the reference palette's dark-mode yellow. Validated next to the blue
// series on the stone-900 card (dataviz checks; CVD ΔE 27). Size and the "PR"
// label carry it too, so it never relies on color alone.
export const PR_COLOR = '#c98500'

/** Legend entry shown above a chart that has PR markers. */
export function PrLegend() {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-xs text-stone-400" aria-hidden="true">
      <svg width="12" height="12">
        <circle cx="6" cy="6" r="5" fill={PR_COLOR} />
      </svg>
      Personal record
    </div>
  )
}

/** Tooltip label for a PR point. */
export function PrBadge() {
  return (
    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-stone-100">
      <svg width="10" height="10" aria-hidden="true">
        <circle cx="5" cy="5" r="4" fill={PR_COLOR} />
      </svg>
      PR
    </p>
  )
}
