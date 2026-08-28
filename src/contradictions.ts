import type { Candidate } from './profiles/types.js'

// See ../Spec-Ingest-Tool.md section 9A ("Where the sources disagree").
// Detects three kinds of disagreement across the whole corpus, tuned to
// under-report: a false conflict costs ten minutes of checking two sources
// that agree; report enough of those and the real ones stop being read.

export interface Contradiction {
  kind: 'quantity' | 'version' | 'requiredness'
  claims: { text: string; ref: string; value: string }[]
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'of', 'to', 'is', 'in', 'on', 'for', 'and', 'or', 'be',
  'must', 'shall', 'not', 'no', 'later', 'than', 'at', 'least', 'minimum',
])

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
}

function overlapScore(a: string[], b: string[]): number {
  const setB = new Set(b)
  return a.filter((w) => setB.has(w)).length
}

/** Quantities: same significant words + matching unit, more than one distinct value. */
function findQuantityContradictions(candidates: Candidate[]): Contradiction[] {
  const QUANTITY_RE = /(\d+(?:\.\d+)?)\s*(months?|days?|years?|weeks?|hours?|MB|GB|KB|%)\b/gi
  type Mention = { text: string; ref: string; value: string; unit: string; words: string[] }
  const mentions: Mention[] = []

  for (const c of candidates) {
    const matches = [...c.text.matchAll(QUANTITY_RE)]
    // A line carrying two quantities is a range or a table row — skip it,
    // pairing it with anything else is guesswork.
    if (matches.length !== 1) continue
    const [, value, unit] = matches[0]
    mentions.push({
      text: c.text,
      ref: c.ref,
      value,
      unit: unit.toLowerCase().replace(/s$/, ''),
      words: significantWords(c.text),
    })
  }

  const groups: Mention[][] = []
  for (const mention of mentions) {
    const group = groups.find(
      (g) => g[0].unit === mention.unit && overlapScore(g[0].words, mention.words) >= 2,
    )
    if (group) group.push(mention)
    else groups.push([mention])
  }

  return groups
    .filter((g) => new Set(g.map((m) => m.value)).size > 1)
    .map((g) => ({
      kind: 'quantity' as const,
      claims: g.map((m) => ({ text: m.text, ref: m.ref, value: `${m.value} ${m.unit}` })),
    }))
}

/** Versions: a version token cited two different ways for what looks like the same subject. */
function findVersionContradictions(candidates: Candidate[]): Contradiction[] {
  const VERSION_RE = /\bv(?:ersion)?\.?\s?(\d+(?:\.\d+)*)\b/gi
  type Mention = { text: string; ref: string; value: string; words: string[] }
  const mentions: Mention[] = []

  for (const c of candidates) {
    const matches = [...c.text.matchAll(VERSION_RE)]
    if (matches.length !== 1) continue
    mentions.push({ text: c.text, ref: c.ref, value: matches[0][1], words: significantWords(c.text) })
  }

  const groups: Mention[][] = []
  for (const mention of mentions) {
    const group = groups.find((g) => overlapScore(g[0].words, mention.words) >= 2)
    if (group) group.push(mention)
    else groups.push([mention])
  }

  return groups
    .filter((g) => new Set(g.map((m) => m.value)).size > 1)
    .map((g) => ({
      kind: 'version' as const,
      claims: g.map((m) => ({ text: m.text, ref: m.ref, value: `v${m.value}` })),
    }))
}

/** Requiredness: the same field label marked required in one source, not in another. Exact, not fuzzy. */
function findRequirednessContradictions(candidates: Candidate[]): Contradiction[] {
  const REQUIRED_RE = /^(.+?)\s*(?:is|are|—|-)?\s*(required|not required|optional)\b/i
  type Mention = { text: string; ref: string; label: string; value: string }
  const mentions: Mention[] = []

  for (const c of candidates) {
    const match = REQUIRED_RE.exec(c.text)
    if (!match) continue
    mentions.push({
      text: c.text,
      ref: c.ref,
      label: match[1].trim().toLowerCase(),
      value: /not required|optional/i.test(match[2]) ? 'not required' : 'required',
    })
  }

  const byLabel = new Map<string, Mention[]>()
  for (const mention of mentions) {
    const list = byLabel.get(mention.label) ?? []
    list.push(mention)
    byLabel.set(mention.label, list)
  }

  return [...byLabel.values()]
    .filter((g) => new Set(g.map((m) => m.value)).size > 1)
    .map((g) => ({
      kind: 'requiredness' as const,
      claims: g.map((m) => ({ text: m.text, ref: m.ref, value: m.value })),
    }))
}

export function findContradictions(candidates: Candidate[]): Contradiction[] {
  return [
    ...findQuantityContradictions(candidates),
    ...findVersionContradictions(candidates),
    ...findRequirednessContradictions(candidates),
  ]
}
