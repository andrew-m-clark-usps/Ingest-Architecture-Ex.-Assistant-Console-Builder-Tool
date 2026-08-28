import { readFile, readdir } from 'node:fs/promises'
import { join, relative, extname } from 'node:path'
import type { Candidate } from './profiles/types.js'

// See ../Spec-Ingest-Tool.md section 5B ("Reading the existing codebase").
// The documents say what the system was meant to do; the code is what it
// does, and where the two differ the code wins until somebody decides
// otherwise. Reads a checkout (bytes handed in by the caller's file
// system — cloning is the caller's business), and takes structure only:
// routes, field definitions, validation/enums/status codes, message
// contracts, schema, test names, and configuration KEY NAMES — never a
// credential, token, connection string, private key, or a fixture value
// that looks like a real person.

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage', '.next', '.nuxt',
  'vendor', 'generated', '__pycache__', '.venv', 'venv',
])
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.cs', '.go', '.rb', '.sql', '.yaml', '.yml', '.json',
])

const CREDENTIAL_SHAPE_RE =
  /(?:api[_-]?key|secret|token|password|passwd|connectionstring|private[_-]?key)\s*[:=]\s*['"][^'"]{6,}['"]/i

const ROUTE_PATTERNS: { re: RegExp; methodGroup: number; pathGroup: number }[] = [
  { re: /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi, methodGroup: 1, pathGroup: 2 },
  { re: /@(Get|Post|Put|Patch|Delete)\s*\(\s*['"`]?([^'")`]*)['"`]?\s*\)/g, methodGroup: 1, pathGroup: 2 },
  { re: /@app\.route\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*methods\s*=\s*\[([^\]]*)\])?\)/g, methodGroup: 2, pathGroup: 1 },
]

const ENV_KEY_RE = /process\.env\.([A-Z0-9_]+)|process\.env\[['"]([A-Z0-9_]+)['"]\]|os\.environ(?:\.get\(|\[)['"]([A-Z0-9_]+)['"]/g
const ENUM_RE = /\benum\s+(\w+)\s*\{([^}]*)\}/g
const TEST_NAME_RE = /\b(?:test|it|describe)\s*\(\s*['"`]([^'"`]+)['"`]/g
const SQL_TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`]?(\w+)["`]?\s*\(([\s\S]*?)\);/gi
const TODO_RE = /\/\/\s*(TODO|FIXME|XXX)[:\s](.*)/g
const COMMENTED_CODE_RE = /\/\/\s*(?:app|router)\.(get|post|put|patch|delete)\s*\(/gi
const VALIDATOR_DECORATOR_RE = /@(IsNotEmpty|IsOptional|IsEmail|IsEnum|MinLength|MaxLength|Matches)\s*\(([^)]*)\)/g

function isGeneratedFile(relPath: string): boolean {
  return /(^|\/)(generated|\.generated|__generated__)(\/|\.)/.test(relPath) || /\.generated\./.test(relPath)
}

async function walk(dir: string, root: string, files: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue
    if (SKIP_DIRS.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, root, files)
    } else if (TEXT_EXTENSIONS.has(extname(entry.name))) {
      const rel = relative(root, full).split('\\').join('/')
      if (!isGeneratedFile(rel)) files.push(full)
    }
  }
}

function scrubCredentialShapedLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (CREDENTIAL_SHAPE_RE.test(line) ? '[redacted: credential-shaped value]' : line))
    .join('\n')
}

function extractFromFile(rawText: string, ref: string): Candidate[] {
  const candidates: Candidate[] = []
  const text = scrubCredentialShapedLines(rawText)

  for (const { re, methodGroup, pathGroup } of ROUTE_PATTERNS) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const method = (m[methodGroup] ?? '').toUpperCase() || 'ROUTE'
      const path = m[pathGroup] ?? ''
      if (!path) continue
      candidates.push({ kind: 'endpoint', text: `${method} ${path}`, ref, because: 'route declaration in code' })
    }
  }

  ENV_KEY_RE.lastIndex = 0
  let envMatch: RegExpExecArray | null
  while ((envMatch = ENV_KEY_RE.exec(text)) !== null) {
    const key = envMatch[1] ?? envMatch[2] ?? envMatch[3]
    // Configuration keys are structure; configuration VALUES are secrets
    // until proven otherwise — only the key name is ever carried across.
    candidates.push({ kind: 'field', text: `config key: ${key}`, ref, because: 'configuration key name (value never read)' })
  }

  ENUM_RE.lastIndex = 0
  let enumMatch: RegExpExecArray | null
  while ((enumMatch = ENUM_RE.exec(text)) !== null) {
    const members = enumMatch[2]
      .split(',')
      .map((s) => s.trim().split('=')[0].trim())
      .filter(Boolean)
    if (members.length > 0) {
      candidates.push({
        kind: 'rule',
        text: `enum ${enumMatch[1]}: ${members.join(', ')}`,
        ref,
        because: 'enum declaration in code',
      })
    }
  }

  VALIDATOR_DECORATOR_RE.lastIndex = 0
  let validatorMatch: RegExpExecArray | null
  while ((validatorMatch = VALIDATOR_DECORATOR_RE.exec(text)) !== null) {
    candidates.push({
      kind: 'rule',
      text: `${validatorMatch[1]}(${validatorMatch[2]})`,
      ref,
      because: 'validation decorator — a rule that exists nowhere else',
    })
  }

  TEST_NAME_RE.lastIndex = 0
  let testMatch: RegExpExecArray | null
  while ((testMatch = TEST_NAME_RE.exec(text)) !== null) {
    candidates.push({ kind: 'step', text: testMatch[1], ref, because: 'test name — behaviour somebody thought worth pinning' })
  }

  SQL_TABLE_RE.lastIndex = 0
  let tableMatch: RegExpExecArray | null
  while ((tableMatch = SQL_TABLE_RE.exec(text)) !== null) {
    const columns = tableMatch[2]
      .split(',')
      .map((segment) => /^\s*["`]?(\w+)["`]?\s+(\w+)/.exec(segment.trim()))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]}:${m[2]}`)
    candidates.push({
      kind: 'record',
      text: `table ${tableMatch[1]} (${columns.join(', ')})`,
      ref,
      because: 'CREATE TABLE in schema/migration',
    })
  }

  // A TODO or a commented-out block is somebody's abandoned intention —
  // extract as a question, never as a rule.
  TODO_RE.lastIndex = 0
  let todoMatch: RegExpExecArray | null
  while ((todoMatch = TODO_RE.exec(text)) !== null) {
    candidates.push({
      kind: 'heading',
      text: `question: ${todoMatch[1]} — ${todoMatch[2].trim()}`,
      ref,
      because: 'TODO/FIXME comment: an abandoned intention, not a specification',
    })
  }
  COMMENTED_CODE_RE.lastIndex = 0
  if (COMMENTED_CODE_RE.test(text)) {
    candidates.push({
      kind: 'heading',
      text: `question: commented-out route handler(s) present`,
      ref,
      because: 'commented-out code is not a specification either',
    })
  }

  return candidates
}

export interface CodebaseReadResult {
  candidates: Candidate[]
  filesRead: number
  filesSkipped: string[]
}

export async function readCodebase(rootDir: string): Promise<CodebaseReadResult> {
  const files: string[] = []
  await walk(rootDir, rootDir, files)

  const candidates: Candidate[] = []
  const filesSkipped: string[] = []

  for (const file of files) {
    const rel = relative(rootDir, file).split('\\').join('/')
    let content: string
    try {
      content = await readFile(file, 'utf-8')
    } catch {
      filesSkipped.push(rel)
      continue
    }
    candidates.push(...extractFromFile(content, rel))
  }

  return { candidates, filesRead: files.length, filesSkipped }
}
