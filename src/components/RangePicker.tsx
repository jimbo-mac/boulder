import { RANGES, type RangeValue } from '../lib/ranges'
import { chipClass } from './ui'

/** The 1w / 1m / 3m buttons on each Progress view. */
export function RangePicker({ value, onChange }: { value: RangeValue; onChange: (range: RangeValue) => void }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Time range">
      {RANGES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`${chipClass(value === option.value)} flex-1 md:flex-none md:px-4`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
