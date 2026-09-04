// See Spec-Ingest-Tool.md section 10 (reconciling an old artifact against a
// newer system). Matching is exact, on a normalized label -- no stemmer,
// no fuzzy distance, per the brief.

export interface ReconcileResult {
  alreadyHeld: string[]
  stillManual: string[]
  newInTarget: string[]
}

// Hand-written synonym table (not a stemmer/fuzzy match) mapping an old
// label's normalized form to the new system's vocabulary.
const SYNONYMS: Record<string, string> = {
  'zip code': 'zip5',
  zipcode: 'zip5',
  'street address': 'delivery line',
  'suite apt': 'secondary',
  'suite number': 'secondary',
}

function normalize(label: string, synonyms: Record<string, string>): string {
  const stripped = label
    .replace(/\([^)]*\)/g, '') // drop parentheticals
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return synonyms[stripped] ?? stripped
}

export function reconcile(
  oldFields: string[],
  newFields: string[],
  synonyms: Record<string, string> = SYNONYMS,
): ReconcileResult {
  const normalizedNew = new Map(newFields.map((f) => [normalize(f, synonyms), f]))
  const usedNew = new Set<string>()

  const alreadyHeld: string[] = []
  const stillManual: string[] = []

  for (const oldField of oldFields) {
    const key = normalize(oldField, synonyms)
    const match = normalizedNew.get(key)
    if (match) {
      alreadyHeld.push(oldField)
      usedNew.add(key)
    } else {
      stillManual.push(oldField)
    }
  }

  const newInTarget = newFields.filter((f) => !usedNew.has(normalize(f, synonyms)))

  return { alreadyHeld, stillManual, newInTarget }
}
