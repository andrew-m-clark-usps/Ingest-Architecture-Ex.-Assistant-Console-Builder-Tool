import type { Candidate } from './profiles/types.js'

// See ../Spec-Ingest-Tool.md section 7A ("Where inference is allowed, and
// what it may never do"): "Inference may propose a candidate. It may never
// decide anything." This module is the deterministic-path guardrail
// itself — it only ever ADDS candidates flagged as model-proposed; it
// never alters, reorders, or removes what the deterministic classifiers
// in specExtract.ts already produced. --no-ml is the default; enabling
// inference must never change a single byte of the deterministic output,
// which is exactly what noMlParity.test.ts asserts.

export interface InferenceOptions {
  modelName: string
  modelVersion: string
}

/**
 * Suggests candidates for lines the deterministic classifier in
 * specExtract.ts walked past (see section 7A) — e.g. a sentence stating a
 * rule with no normative language in it. This scaffold's "model" is a
 * conservative, deterministic heuristic (no model-provider SDK is
 * installed, per section 2/7A); it stands in for a real local, pinned
 * model without adding a dependency this package does not ship.
 */
export function proposeAdditionalCandidates(
  lines: string[],
  ref: string,
  options: InferenceOptions,
): Candidate[] {
  const because = `model-proposed (${options.modelName} v${options.modelVersion}), unconfirmed`
  const proposals: Candidate[] = []
  for (const raw of lines) {
    const text = raw.trim()
    if (text.length === 0) continue
    // A plausible-but-unproven "rule" signal: an obligation phrased
    // without the normative words specExtract.ts matches on.
    if (/\bretains?\b|\bkeeps?\b|\bmaintains?\b/i.test(text) && /\bfor each\b|\bper\b/i.test(text)) {
      proposals.push({ kind: 'rule', text, ref, because })
    }
  }
  return proposals
}

/**
 * The parity contract itself: every deterministic candidate must appear,
 * byte-identical, in the model-enabled result. Returns the deterministic
 * candidates followed by whatever the model proposed — model output is
 * always additive and always at the end, never interleaved or reordering
 * what came before it.
 */
export function withOptionalInference(
  deterministic: Candidate[],
  proposed: Candidate[],
  mlEnabled: boolean,
): Candidate[] {
  return mlEnabled ? [...deterministic, ...proposed] : deterministic
}
