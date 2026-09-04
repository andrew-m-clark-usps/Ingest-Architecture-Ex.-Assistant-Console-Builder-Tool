// See Spec-Ingest-Tool.md section 13A (the audit log).
//
// One append-only JSON-lines schema, used by the CLI and MCP server
// alike. Logs identifiers, hashes, and byte counts -- NEVER the extracted
// content itself, which would otherwise create an unmanaged second copy
// of a licensed or sensitive document. Refusals are logged too (the
// brief calls them "the most valuable entries, and the ones a naive
// logger drops because nothing was produced").
import { createHash } from 'node:crypto'
import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { SourceMarking } from './markings.js'

export interface AuditRecord {
  at: string
  who: string
  read?: { path: string; contentHash: string; byteCount: number; classification?: SourceMarking }
  against?: { profileId: string; toolVersion: string }
  produced?: { contentHash: string; sections: string[]; classification?: SourceMarking }
  refusal?: { reason: string }
}

export const DEFAULT_AUDIT_LOG = 'log/audit.jsonl'

export function hashContent(bytes: Uint8Array | string): string {
  const hash = createHash('sha256')
  hash.update(bytes)
  return hash.digest('hex')
}

export async function appendAuditRecord(
  record: Omit<AuditRecord, 'at'>,
  logPath: string = DEFAULT_AUDIT_LOG,
): Promise<void> {
  await mkdir(dirname(logPath), { recursive: true })
  const full: AuditRecord = { at: new Date().toISOString(), ...record }
  await appendFile(logPath, JSON.stringify(full) + '\n', 'utf-8')
}
