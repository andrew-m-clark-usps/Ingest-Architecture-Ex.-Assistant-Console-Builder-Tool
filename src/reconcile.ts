// See ../Spec-Ingest-Tool.md section 10 ("Reconciling an old artifact
// against a newer system"). Matches field labels between two sources and
// reports three lists. Normalises by dropping parentheticals and applying
// a small, explicit synonym table — never a stemmer or fuzzy distance,
// which could quietly pair unrelated labels (e.g. "Business Name" with
// "Business Portal") and propose deleting a field from a legal form.

export interface ReconcileResult {
  alreadyHeld: string[]
  stillManual: string[]
  newInTarget: string[]
}

function normalize(label: string, synonyms: Readonly<Record<string, string>>): string {
  const withoutParens = label.replace(/\([^)]*\)/g, ' ')
  const lower = withoutParens.trim().toLowerCase().replace(/\s+/g, ' ')
  return synonyms[lower] ?? lower
}

export function reconcile(
  oldFields: string[],
  newFields: string[],
  synonyms: Readonly<Record<string, string>> = {},
): ReconcileResult {
  const normalizedOld = oldFields.map((f) => ({ raw: f, key: normalize(f, synonyms) }))
  const normalizedNew = newFields.map((f) => ({ raw: f, key: normalize(f, synonyms) }))
  const newKeys = new Set(normalizedNew.map((f) => f.key))
  const oldKeys = new Set(normalizedOld.map((f) => f.key))

  const alreadyHeld: string[] = []
  const stillManual: string[] = []
  for (const field of normalizedOld) {
    if (newKeys.has(field.key)) alreadyHeld.push(field.raw)
    else stillManual.push(field.raw)
  }

  const newInTarget = normalizedNew.filter((f) => !oldKeys.has(f.key)).map((f) => f.raw)

  return { alreadyHeld, stillManual, newInTarget }
}
