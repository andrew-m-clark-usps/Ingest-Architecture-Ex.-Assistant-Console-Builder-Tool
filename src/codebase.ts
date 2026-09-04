import type { Candidate } from './profiles/types.js'

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json'])
const SKIP_PATH_PARTS = ['node_modules', 'dist/', '/dist/', 'build/', '/build/', 'coverage/', '/coverage/']
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const

function compareText(a: string, b: string): number {
  return a.localeCompare(b)
}

function normalizePath(path: string): string {
  return path.replaceAll('\\', '/').toLowerCase()
}

function hasSourceExtension(path: string): boolean {
  const idx = path.lastIndexOf('.')
  if (idx === -1) return false
  return SOURCE_EXTENSIONS.has(path.slice(idx).toLowerCase())
}

function shouldSkipPath(path: string): boolean {
  const normalized = normalizePath(path)
  if (!hasSourceExtension(normalized)) return true
  return SKIP_PATH_PARTS.some((part) => normalized.includes(part))
}

function pushUnique(candidates: Candidate[], next: Candidate): void {
  if (!candidates.some((candidate) => candidate.kind === next.kind && candidate.text === next.text && candidate.ref === next.ref)) {
    candidates.push(next)
  }
}

function appendHttpRouteCandidates(candidates: Candidate[], text: string, refBase: string): void {
  const routeRe = /\b(?:router|app|server)\.(get|post|put|patch|delete|options|head)\(\s*['"`]([^'"`]+)['"`]/gi
  for (const match of text.matchAll(routeRe)) {
    pushUnique(candidates, {
      kind: 'endpoint',
      text: `${match[1].toUpperCase()} ${match[2]}`,
      ref: `${refBase}#route:${match[1].toLowerCase()}:${match[2]}`,
      because: 'HTTP route declaration in codebase',
    })
  }
}

function appendFetchCandidates(candidates: Candidate[], text: string, refBase: string): void {
  const fetchRe = /\bfetch\(\s*['"`]([^'"`]+)['"`]/gi
  for (const match of text.matchAll(fetchRe)) {
    pushUnique(candidates, {
      kind: 'endpoint',
      text: `GET ${match[1]}`,
      ref: `${refBase}#http-call:GET:${match[1]}`,
      because: 'HTTP client call in codebase',
    })
  }

  const clientRe = /\b(?:axios|http)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/gi
  for (const match of text.matchAll(clientRe)) {
    const method = match[1].toUpperCase()
    if (!HTTP_METHODS.includes(method as (typeof HTTP_METHODS)[number])) continue
    pushUnique(candidates, {
      kind: 'endpoint',
      text: `${method} ${match[2]}`,
      ref: `${refBase}#http-call:${method}:${match[2]}`,
      because: 'HTTP client call in codebase',
    })
  }
}

function appendRouterConfigCandidates(candidates: Candidate[], text: string, refBase: string): void {
  const pathRe = /\bpath\s*:\s*['"`]([^'"`]+)['"`]/g
  for (const match of text.matchAll(pathRe)) {
    const pathName = match[1]
    if (!pathName.startsWith('/') && !pathName.startsWith(':') && !/^[a-z0-9_-]+(?:\/[a-z0-9_:-]+)*$/i.test(pathName)) continue
    const routePath = pathName.startsWith('/') ? pathName : `/${pathName}`
    pushUnique(candidates, {
      kind: 'endpoint',
      text: `ROUTE ${routePath}`,
      ref: `${refBase}#router-path:${pathName}`,
      because: 'router path declaration in codebase',
    })
  }
}

function appendInterfaceFields(candidates: Candidate[], text: string, refBase: string): void {
  const lines = text.split(/\r\n|\r|\n/)
  let activeTypeName: string | undefined

  for (const line of lines) {
    if (activeTypeName === undefined) {
      const typeMatch = /^\s*(?:export\s+)?(?:interface|type)\s+(\w+)\s*(?:=\s*)?{\s*$/.exec(line)
      if (typeMatch) activeTypeName = typeMatch[1]
      continue
    }

    if (/^\s*}/.test(line)) {
      activeTypeName = undefined
      continue
    }

    const propMatch = /^\s*(\w+)\??\s*:/.exec(line)
    if (!propMatch) continue
    pushUnique(candidates, {
      kind: 'field',
      text: propMatch[1],
      ref: `${refBase}#type:${activeTypeName}.${propMatch[1]}`,
      because: 'model/interface field in codebase',
    })
  }
}

function appendEnumStates(candidates: Candidate[], text: string, refBase: string): void {
  const enumRe = /enum\s+(\w+)\s*{([\s\S]*?)}/g
  for (const match of text.matchAll(enumRe)) {
    const enumName = match[1]
    const body = match[2]
    for (const memberMatch of body.matchAll(/\b([A-Z][A-Z0-9_]+)\b/g)) {
      pushUnique(candidates, {
        kind: 'state',
        text: memberMatch[1],
        ref: `${refBase}#enum:${enumName}.${memberMatch[1]}`,
        because: 'enum/status value in codebase',
      })
    }
  }
}

function appendConfigKeys(candidates: Candidate[], text: string, refBase: string): void {
  const envRe = /\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]+)/g
  for (const match of text.matchAll(envRe)) {
    pushUnique(candidates, {
      kind: 'field',
      text: match[1],
      ref: `${refBase}#config:${match[1]}`,
      because: 'configuration key name in codebase',
    })
  }
}

export function readCodebaseCandidates(text: string, refBase: string): Candidate[] {
  if (shouldSkipPath(refBase)) return []

  const candidates: Candidate[] = []
  appendHttpRouteCandidates(candidates, text, refBase)
  appendFetchCandidates(candidates, text, refBase)
  appendRouterConfigCandidates(candidates, text, refBase)
  appendInterfaceFields(candidates, text, refBase)
  appendEnumStates(candidates, text, refBase)
  appendConfigKeys(candidates, text, refBase)
  return candidates.sort((a, b) => compareText(`${a.kind}\u0000${a.text}\u0000${a.ref}`, `${b.kind}\u0000${b.text}\u0000${b.ref}`))
}