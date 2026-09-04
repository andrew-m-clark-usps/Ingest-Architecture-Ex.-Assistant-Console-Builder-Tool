// See Spec-Ingest-Tool.md section 2a (secrets that arrive inside
// sources): before writing a brief, scan the assembled output for
// high-entropy/known credential shapes and refuse to write rather than
// redact silently, naming the source (`ref`) and which shape matched.
import type { Candidate } from './profiles/types.js'

export interface CredentialFinding {
  ref: string
  shape: string
  text: string
}

interface ShapePattern {
  shape: string
  pattern: RegExp
}

const CREDENTIAL_PATTERNS: ShapePattern[] = [
  { shape: 'bearer-token', pattern: /\bBearer [A-Za-z0-9._-]{10,}\b/ },
  { shape: 'basic-token', pattern: /\bBasic [A-Za-z0-9+/=]{10,}\b/ },
  { shape: 'jwt', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { shape: 'private-key-header', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { shape: 'client-secret-assignment', pattern: /\bclient_secret\s*[:=]\s*\S+/i },
  { shape: 'session-cookie', pattern: /\b(?:Set-Cookie|Cookie):\s*[^\s;]+=[^\s;]+/i },
]

// Scans candidates only for the SHAPE of a credential -- never captures
// or logs the actual value found; a source name and line reference are
// enough for a human to go redact the real document.
export function scanForCredentials(candidates: Candidate[]): CredentialFinding[] {
  const findings: CredentialFinding[] = []
  for (const candidate of candidates) {
    for (const { shape, pattern } of CREDENTIAL_PATTERNS) {
      if (pattern.test(candidate.text)) {
        findings.push({ ref: candidate.ref, shape, text: candidate.text })
      }
    }
  }
  return findings
}
