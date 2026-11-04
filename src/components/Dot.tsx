/** Small round marker. Hollow (outline only) means "not done". */
export function Dot({ color, size = 8, hollow = false }: { color: string; size?: number; hollow?: boolean }) {
  const r = size / 2 - 1
  return (
    <svg width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill={hollow ? 'none' : color}
        stroke={hollow ? '#44403c' : 'none'}
        strokeWidth={hollow ? 1 : 0}
      />
    </svg>
  )
}
