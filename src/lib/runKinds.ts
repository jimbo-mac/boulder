/** Run types, in the order shown on the Log screen. Must match the DB check constraint. */
export const RUN_KINDS = [
  { value: 'base', label: 'Base' },
  { value: 'long', label: 'Long' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'speed', label: 'Speed' },
] as const

export type RunKind = (typeof RUN_KINDS)[number]['value']

export function isRunKind(value: string): value is RunKind {
  return RUN_KINDS.some((kind) => kind.value === value)
}

export function runKindLabel(kind: RunKind): string {
  return RUN_KINDS.find((k) => k.value === kind)?.label ?? kind
}
