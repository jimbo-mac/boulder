/** Exercise categories. Must match the DB check constraint. */
export const CATEGORIES = [
  { value: 'squat', label: 'Squat' },
  { value: 'hinge', label: 'Hinge' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'other', label: 'Other' },
] as const

export type Category = (typeof CATEGORIES)[number]['value']

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((c) => c.value === value)
}

export interface Exercise {
  id: string
  name: string
  category: Category
}

/** Offered in the picker until added, so a new catalog isn't empty. */
export const SUGGESTED_EXERCISES: readonly { name: string; category: Category }[] = [
  { name: 'Back Squat', category: 'squat' },
  { name: 'Front Squat', category: 'squat' },
  { name: 'Deadlift', category: 'hinge' },
  { name: 'Romanian Deadlift', category: 'hinge' },
  { name: 'Bench Press', category: 'push' },
  { name: 'Overhead Press', category: 'push' },
  { name: 'Incline Bench Press', category: 'push' },
  { name: 'Barbell Row', category: 'pull' },
  { name: 'Pull-up', category: 'pull' },
  { name: 'Lat Pulldown', category: 'pull' },
]

/** Case- and whitespace-insensitive key, matching the DB's unique index on lower(name). */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export interface PickerOptions {
  matches: Exercise[]
  suggestions: { name: string; category: Category }[]
  /** Offer "Create …" when the query is non-empty and not an exact existing name. */
  canCreate: boolean
}

/** What the exercise picker shows for a search query. */
export function pickerOptions(catalog: readonly Exercise[], query: string): PickerOptions {
  const q = nameKey(query)
  const owned = new Set(catalog.map((e) => nameKey(e.name)))
  const matches = catalog
    .filter((e) => q === '' || nameKey(e.name).includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
  const suggestions = SUGGESTED_EXERCISES.filter(
    (s) => !owned.has(nameKey(s.name)) && (q === '' || nameKey(s.name).includes(q)),
  )
  const exact = owned.has(q) || suggestions.some((s) => nameKey(s.name) === q)
  return { matches, suggestions, canCreate: q !== '' && !exact }
}
