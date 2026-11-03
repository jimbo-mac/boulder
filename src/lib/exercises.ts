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
  { name: 'Bicep Curl', category: 'pull' },
  { name: 'Reverse Curl', category: 'pull' },
]

/** Case- and whitespace-insensitive key, matching the DB's unique index on lower(name). */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * Loose search key: letters and digits only, so "pullup", "pull up" and "Pull-up"
 * all match. A trailing plural "s" is dropped so "pullups" and "curls" match too.
 */
export function searchKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function matchesQuery(name: string, query: string): boolean {
  const q = searchKey(query)
  if (q === '') return true
  const key = searchKey(name)
  return key.includes(q) || (q.length > 3 && q.endsWith('s') && key.includes(q.slice(0, -1)))
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
    .filter((e) => matchesQuery(e.name, query))
    .sort((a, b) => a.name.localeCompare(b.name))
  const suggestions = SUGGESTED_EXERCISES.filter(
    (s) => !owned.has(nameKey(s.name)) && matchesQuery(s.name, query),
  )
  const exact = owned.has(q) || suggestions.some((s) => nameKey(s.name) === q)
  return { matches, suggestions, canCreate: q !== '' && !exact }
}
