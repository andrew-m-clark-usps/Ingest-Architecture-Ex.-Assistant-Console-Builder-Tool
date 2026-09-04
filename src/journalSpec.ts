import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Candidate } from './profiles/types.js'

// See Spec-Ingest-Tool.md section 6 (reading a recorded session:
// meta.json, fields.json, ax-tree.json, styles.json). A malformed
// artifact must not fail the whole read -- each file is read
// independently and a bad one is simply skipped.

interface SessionMeta {
  route?: string
  title?: string
}

async function readJson(path: string): Promise<unknown> {
  try {
    const text = await readFile(path, 'utf-8')
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function stripQueryString(route: string): string {
  const idx = route.indexOf('?')
  return idx === -1 ? route : route.slice(0, idx)
}

export async function readRecordedSession(dir: string): Promise<Candidate[]> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return []
  }

  const candidates: Candidate[] = []

  const meta = (await readJson(join(dir, 'meta.json'))) as SessionMeta | undefined
  if (meta?.route) {
    const route = stripQueryString(meta.route)
    candidates.push({
      kind: 'state',
      text: meta.title ? `${route} (${meta.title})` : route,
      ref: `${dir}/meta.json`,
      because: 'recorded session route',
    })
  }

  const fields = (await readJson(join(dir, 'fields.json'))) as Array<{ name?: string; label?: string }> | undefined
  if (Array.isArray(fields)) {
    for (const field of fields) {
      const label = field?.label ?? field?.name
      if (typeof label === 'string' && label.trim().length > 0) {
        candidates.push({ kind: 'field', text: label, ref: `${dir}/fields.json`, because: 'recorded field shape' })
      }
    }
  }

  const axTree = (await readJson(join(dir, 'ax-tree.json'))) as Array<{ name?: string; role?: string }> | undefined
  if (Array.isArray(axTree)) {
    for (const node of axTree) {
      if (typeof node?.name === 'string' && node.name.trim().length > 0) {
        candidates.push({
          kind: 'field',
          text: node.name,
          ref: `${dir}/ax-tree.json`,
          because: 'accessible name from recorded session',
        })
      }
    }
  }

  const styles = (await readJson(join(dir, 'styles.json'))) as Record<string, string> | undefined
  if (styles && typeof styles === 'object') {
    for (const [token, value] of Object.entries(styles)) {
      if (typeof value === 'string') {
        candidates.push({
          kind: 'style',
          text: `${token}: ${value}`,
          ref: `${dir}/styles.json`,
          because: 'design token captured from recorded session',
        })
      }
    }
  }

  if (Array.isArray(entries) === false) return candidates
  return candidates
}
