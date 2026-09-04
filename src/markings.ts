export type SourceMarking =
  | 'PUBLIC'
  | 'INTERNAL USE ONLY'
  | 'CONFIDENTIAL'
  | 'PRIVILEGED'
  | 'SENSITIVE'

const MARKING_PATTERNS: Array<{ marking: SourceMarking; pattern: RegExp }> = [
  { marking: 'SENSITIVE', pattern: /\bsensitive\b/i },
  { marking: 'PRIVILEGED', pattern: /\bprivileged\b/i },
  { marking: 'CONFIDENTIAL', pattern: /\bconfidential\b/i },
  { marking: 'INTERNAL USE ONLY', pattern: /\binternal use only\b/i },
  { marking: 'PUBLIC', pattern: /\bpublic\b/i },
]

const MARKING_RANK: Record<SourceMarking, number> = {
  PUBLIC: 0,
  'INTERNAL USE ONLY': 1,
  CONFIDENTIAL: 2,
  PRIVILEGED: 3,
  SENSITIVE: 4,
}

function strongestMarking(markings: SourceMarking[]): SourceMarking | undefined {
  if (markings.length === 0) return undefined
  const [first, ...rest] = markings
  return rest.reduce((current, next) => (MARKING_RANK[next] > MARKING_RANK[current] ? next : current), first)
}

export function detectMarking(lines: string[]): SourceMarking | undefined {
  const window = [...lines.slice(0, 8), ...lines.slice(-8)]
  const found: SourceMarking[] = []
  for (const line of window) {
    for (const { marking, pattern } of MARKING_PATTERNS) {
      if (pattern.test(line)) found.push(marking)
    }
  }
  return strongestMarking(found)
}

export function mergeMarkings(markings: Array<SourceMarking | undefined>): SourceMarking | undefined {
  return strongestMarking(markings.filter((marking): marking is SourceMarking => marking !== undefined))
}