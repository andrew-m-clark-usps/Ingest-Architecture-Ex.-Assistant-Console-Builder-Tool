import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Candidate } from './profiles/types.js'
import { hashContent } from './audit.js'

// See Spec-Ingest-Tool.md section 6 (reading a recorded session:
// meta.json, fields.json, ax-tree.json, styles.json). A malformed
// artifact must not fail the whole read -- each file is read
// independently and a bad one is simply skipped.

interface SessionMeta {
  route?: string
  title?: string
}

interface SessionField {
  name?: string
  label?: string
}

interface SessionAxNode {
  name?: string
  role?: string
}

interface CapturedRequest {
  method?: string
  url?: string
  path?: string
  status?: number
  requestBody?: unknown
  requestBodyShape?: unknown
  responseBody?: unknown
  responseBodyShape?: unknown
}

export interface RecordedSessionArtifact {
  path: string
  kind: 'meta' | 'fields' | 'ax-tree' | 'styles' | 'requests' | 'har' | 'other'
  byteCount: number
  contentHash: string
  issues: string[]
}

export interface RecordedSessionInventory {
  dir: string
  artifacts: RecordedSessionArtifact[]
  refusalReasons: string[]
}

const SESSION_ARTIFACT_KINDS = new Map<string, RecordedSessionArtifact['kind']>([
  ['meta.json', 'meta'],
  ['fields.json', 'fields'],
  ['ax-tree.json', 'ax-tree'],
  ['styles.json', 'styles'],
  ['requests.json', 'requests'],
  ['har.json', 'har'],
])

const SENSITIVE_HEADER_KEYS = new Set(['authorization', 'cookie', 'set-cookie'])
const REQUEST_BODY_KEYS = new Set(['body', 'requestbody', 'postdata', 'postdatatext'])

function artifactKind(name: string): RecordedSessionArtifact['kind'] {
  return SESSION_ARTIFACT_KINDS.get(name) ?? 'other'
}

function isNonEmptyValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.keys(value).length > 0
  return value !== undefined && value !== null
}

function isShapeOnlyBodyContainer(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const keys = Object.keys(value)
  return keys.length === 1 && keys[0].toLowerCase() === 'shape'
}

function inspectJsonValue(value: unknown, issues: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) inspectJsonValue(item, issues)
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, nested] of Object.entries(value)) {
    const normalized = key.toLowerCase()
    if (SENSITIVE_HEADER_KEYS.has(normalized) && isNonEmptyValue(nested)) {
      issues.add(`captured sensitive header value (${normalized})`)
    }
    if (REQUEST_BODY_KEYS.has(normalized) && isNonEmptyValue(nested) && !isShapeOnlyBodyContainer(nested)) {
      issues.add(`captured request body value (${normalized})`)
    }
    inspectJsonValue(nested, issues)
  }
}

function inspectTextForSensitiveValues(text: string, issues: Set<string>): void {
  if (/"authorization"\s*:\s*"[^"]+"/i.test(text)) {
    issues.add('captured sensitive header value (authorization)')
  }
  if (/"(?:set-cookie|cookie)"\s*:\s*"[^"]+"/i.test(text)) {
    issues.add('captured sensitive header value (cookie)')
  }
  if (/"(?:body|requestBody|postData|postDataText)"\s*:\s*(?:"[^"]+"|\{[^}]+\}|\[[^\]]+\])/i.test(text)) {
    issues.add('captured request body value')
  }
}

function refusalReason(artifact: RecordedSessionArtifact): string | undefined {
  if (artifact.issues.length === 0) return undefined
  return `${artifact.path}: ${artifact.issues.join('; ')}`
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b)
}

function readArtifactEntryNames(inventory: RecordedSessionInventory): string[] {
  return inventory.artifacts
    .map((artifact) => artifact.path.split('/').pop())
    .filter((entry): entry is string => entry !== undefined)
}

function appendMetaCandidates(candidates: Candidate[], dir: string, meta: SessionMeta | undefined): void {
  if (!meta?.route) return

  const route = stripQueryString(meta.route)
  candidates.push({
    kind: 'state',
    text: meta.title ? `${route} (${meta.title})` : route,
    ref: `${dir}/meta.json`,
    because: 'recorded session route',
  })
}

function appendFieldCandidates(candidates: Candidate[], dir: string, fields: SessionField[] | undefined): void {
  if (!Array.isArray(fields)) return

  for (const field of fields) {
    const label = field?.label ?? field?.name
    if (typeof label === 'string' && label.trim().length > 0) {
      candidates.push({ kind: 'field', text: label, ref: `${dir}/fields.json`, because: 'recorded field shape' })
    }
  }
}

function appendAxTreeCandidates(candidates: Candidate[], dir: string, axTree: SessionAxNode[] | undefined): void {
  if (!Array.isArray(axTree)) return

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

function appendStyleCandidates(candidates: Candidate[], dir: string, styles: Record<string, string> | undefined): void {
  if (!styles || typeof styles !== 'object') return

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

function normalizeRoutePath(raw: string): string {
  if (/^[a-z]+:\/\//i.test(raw)) {
    try {
      return stripQueryString(new URL(raw).pathname || '/')
    } catch {
      return stripQueryString(raw)
    }
  }
  return stripQueryString(raw)
}

function appendObjectShapeCandidates(candidates: Candidate[], dir: string, ref: string, because: string, value: unknown): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  for (const key of Object.keys(value).sort(compareText)) {
    candidates.push({ kind: 'field', text: key, ref: `${dir}/${ref}`, because })
  }
}

function extractJsonObjectShape(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value !== 'string') return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : undefined
  } catch {
    return undefined
  }
}

function appendCapturedRequestCandidates(candidates: Candidate[], dir: string, ref: string, request: CapturedRequest): void {
  const method = typeof request.method === 'string' ? request.method.toUpperCase() : undefined
  let rawPath: string | undefined
  if (typeof request.url === 'string') rawPath = request.url
  else if (typeof request.path === 'string') rawPath = request.path
  if (method && rawPath) {
    candidates.push({
      kind: 'endpoint',
      text: `${method} ${normalizeRoutePath(rawPath)}`,
      ref: `${dir}/${ref}`,
      because: 'captured network call from running system',
    })
  }

  appendObjectShapeCandidates(candidates, dir, ref, 'captured request body shape key', request.requestBodyShape ?? request.requestBody)
  appendObjectShapeCandidates(candidates, dir, ref, 'captured response body shape key', request.responseBodyShape ?? request.responseBody)
}

function toCapturedRequests(value: unknown): CapturedRequest[] {
  if (Array.isArray(value)) return value.filter((item): item is CapturedRequest => item !== null && typeof item === 'object')
  if (!value || typeof value !== 'object') return []

  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.requests)) {
    return obj.requests.filter((item): item is CapturedRequest => item !== null && typeof item === 'object')
  }
  if (Array.isArray(obj.entries)) {
    return obj.entries.filter((item): item is CapturedRequest => item !== null && typeof item === 'object')
  }
  return []
}

function appendRequestsArtifactCandidates(candidates: Candidate[], dir: string, artifactName: string, payload: unknown): void {
  for (const request of toCapturedRequests(payload)) {
    appendCapturedRequestCandidates(candidates, dir, artifactName, {
      ...request,
      requestBody: extractJsonObjectShape(request.requestBody),
      requestBodyShape: extractJsonObjectShape(request.requestBodyShape),
      responseBody: extractJsonObjectShape(request.responseBody),
      responseBodyShape: extractJsonObjectShape(request.responseBodyShape),
    })
  }
}

function extractHarTextContainerShape(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  return extractJsonObjectShape(record.shape) ?? extractJsonObjectShape(record.text)
}

function harEntryToCapturedRequest(entry: Record<string, unknown>): CapturedRequest | undefined {
  const request = entry.request
  if (!request || typeof request !== 'object') return undefined

  const response = entry.response
  const requestRecord = request as Record<string, unknown>
  const responseRecord = response && typeof response === 'object' ? (response as Record<string, unknown>) : undefined

  return {
    method: typeof requestRecord.method === 'string' ? requestRecord.method : undefined,
    url: typeof requestRecord.url === 'string' ? requestRecord.url : undefined,
    requestBodyShape: extractHarTextContainerShape(requestRecord.postData),
    responseBodyShape: extractHarTextContainerShape(responseRecord?.content),
  }
}

function appendHarCandidates(candidates: Candidate[], dir: string, payload: unknown): void {
  if (!payload || typeof payload !== 'object') return
  const log = (payload as Record<string, unknown>).log
  if (!log || typeof log !== 'object') return
  const rawEntries = (log as Record<string, unknown>).entries
  const entries = Array.isArray(rawEntries) ? rawEntries : []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const captured = harEntryToCapturedRequest(entry as Record<string, unknown>)
    if (!captured) continue
    appendCapturedRequestCandidates(candidates, dir, 'har.json', captured)
  }
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

export async function buildRecordedSessionInventory(dir: string): Promise<RecordedSessionInventory> {
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return { dir, artifacts: [], refusalReasons: [] }
  }

  const artifacts: RecordedSessionArtifact[] = []
  const sortedEntries = [...entries].sort(compareText)
  for (const entry of sortedEntries) {
    const path = join(dir, entry)
    let bytes
    try {
      bytes = await readFile(path)
    } catch {
      continue
    }

    const issues = new Set<string>()
    const text = bytes.toString('utf-8')
    inspectTextForSensitiveValues(text, issues)
    try {
      inspectJsonValue(JSON.parse(text), issues)
    } catch {
      // Non-JSON artifacts are still inventoryable; the raw text scan above
      // already enforces the capture-secret guard for them.
    }

    artifacts.push({
      path: `${dir}/${entry}`,
      kind: artifactKind(entry),
      byteCount: bytes.length,
      contentHash: hashContent(bytes),
      issues: [...issues].sort(compareText),
    })
  }

  const refusalReasons = artifacts.map(refusalReason).filter((reason): reason is string => reason !== undefined)
  return { dir, artifacts, refusalReasons }
}

export async function readRecordedSession(dir: string): Promise<Candidate[]> {
  const inventory = await buildRecordedSessionInventory(dir)
  if (inventory.refusalReasons.length > 0) {
    throw new Error(`refused: captured artifact contains sensitive value(s): ${inventory.refusalReasons.join(' | ')}`)
  }
  const entries = readArtifactEntryNames(inventory)

  const candidates: Candidate[] = []

  appendMetaCandidates(candidates, dir, (await readJson(join(dir, 'meta.json'))) as SessionMeta | undefined)
  appendFieldCandidates(candidates, dir, (await readJson(join(dir, 'fields.json'))) as SessionField[] | undefined)
  appendAxTreeCandidates(candidates, dir, (await readJson(join(dir, 'ax-tree.json'))) as SessionAxNode[] | undefined)
  appendStyleCandidates(candidates, dir, (await readJson(join(dir, 'styles.json'))) as Record<string, string> | undefined)
  appendRequestsArtifactCandidates(candidates, dir, 'requests.json', await readJson(join(dir, 'requests.json')))
  appendHarCandidates(candidates, dir, await readJson(join(dir, 'har.json')))

  if (Array.isArray(entries) === false) return candidates
  return candidates
}
