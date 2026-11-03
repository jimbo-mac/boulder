/** Standard race distances in miles, rounded to the 2 decimals the DB stores. */
export const RACE_DISTANCES = [
  { value: '5k', label: '5K', miles: 3.11 },
  { value: '10k', label: '10K', miles: 6.21 },
  { value: 'half', label: 'Half', miles: 13.11 },
  { value: 'marathon', label: 'Marathon', miles: 26.22 },
] as const

export type RacePreset = (typeof RACE_DISTANCES)[number]['value']

/** Which preset (if any) a stored distance corresponds to. */
export function presetForDistance(miles: number | null): RacePreset | null {
  if (miles === null) return null
  return RACE_DISTANCES.find((race) => Math.abs(race.miles - miles) < 0.005)?.value ?? null
}

/** "Half" for 13.11, otherwise "8.00 mi". */
export function describeDistance(miles: number): string {
  const preset = RACE_DISTANCES.find((race) => Math.abs(race.miles - miles) < 0.005)
  return preset ? preset.label : `${miles.toFixed(2)} mi`
}
