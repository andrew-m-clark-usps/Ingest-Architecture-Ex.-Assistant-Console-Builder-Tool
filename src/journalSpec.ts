import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Candidate } from './profiles/types.js'

// See ../Spec-Ingest-Tool.md section 6 ("Reading a recorded session"). A
// browser recorder writes per-step artifacts (meta.json, fields.json,
// ax-tree.json, styles.json) under one directory per step. Read only
// structure, never values, and a malformed artifact must not fail the
// whole read — it is reported and skipped.

function dropQueryString(url: string): string {
  // Query strings carry session identifiers and record ids; they are not
  // part of the route, and the corpus is going to be pasted into a chat window.
  const qIdx = url.indexOf('?')
  return qIdx === -1 ? url : url.slice(0, qIdx)
}

async function readJsonIfPresent(path: string): Promise<unknown | undefined> {
  try {
    const text = await readFile(path, 'utf-8')
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

async function readOneStep(stepDir: string): Promise<Candidate[]> {
  const candidates: Candidate[] = []

  const meta = await readJsonIfPresent(join(stepDir, 'meta.json'))
  if (isRecord(meta)) {
    if (typeof meta.route === 'string') {
      candidates.push({
        kind: 'url',
        text: dropQueryString(meta.route),
        ref: stepDir,
        because: 'recorded session route',
      })
    }
    if (typeof meta.title === 'string') {
      candidates.push({ kind: 'heading', text: meta.title, ref: stepDir, because: 'recorded page title' })
    }
    // Only a state the step explicitly declares counts — inferring "loaded"
    // from the presence of rows would report false coverage.
    if (typeof meta.state === 'string') {
      candidates.push({ kind: 'state', text: meta.state, ref: stepDir, because: 'explicitly declared state' })
    }
  }

  const fields = await readJsonIfPresent(join(stepDir, 'fields.json'))
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (!isRecord(f) || typeof f.name !== 'string') continue
      const type = typeof f.type === 'string' ? f.type : 'unknown'
      const required = f.required === true ? 'required' : 'not required'
      candidates.push({
        kind: 'field',
        text: `${f.name}: ${type} (${required})`,
        ref: stepDir,
        because: 'recorded form field',
      })
    }
  }

  const axTree = await readJsonIfPresent(join(stepDir, 'ax-tree.json'))
  if (Array.isArray(axTree)) {
    for (const node of axTree) {
      const name = isRecord(node) && typeof node.name === 'string' ? node.name : undefined
      if (name && name.trim().length > 0) {
        candidates.push({ kind: 'field', text: name, ref: stepDir, because: 'accessible name (ax-tree)' })
      }
    }
  }

  const styles = await readJsonIfPresent(join(stepDir, 'styles.json'))
  if (isRecord(styles)) {
    for (const [token, value] of Object.entries(styles)) {
      candidates.push({
        kind: 'style',
        text: `${token}: ${String(value)}`,
        ref: stepDir,
        because: 'recorded design token',
      })
    }
  }

  return candidates
}

/** Read every step subdirectory under a recorded-session directory. */
export async function readRecordedSession(dir: string): Promise<Candidate[]> {
  let entries: string[]
  try {
    entries = await readdir(dir, { withFileTypes: false })
  } catch {
    return []
  }

  const candidates: Candidate[] = []
  for (const entry of entries) {
    const stepDir = join(dir, entry)
    try {
      candidates.push(...(await readOneStep(stepDir)))
    } catch {
      // A malformed artifact must not fail the whole read.
      continue
    }
  }
  return candidates
}
