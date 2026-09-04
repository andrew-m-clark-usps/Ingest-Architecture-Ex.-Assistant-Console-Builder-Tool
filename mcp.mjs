#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 12 (MCP server: JSON-RPC over stdio, no
// SDK). Run `npm run build` first -- this reads compiled output under
// dist/, not src/ directly.
//
// Every requested path is resolved against a root confined at startup
// (the current working directory) and checked against symlink escape
// (via realpath) before it is read. Confinement failures come back as a
// tool result (`isError: true`), never a transport error, naming what was
// rejected and why.
import { createInterface } from 'node:readline'
import { readFile, realpath } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, extname, sep } from 'node:path'
import {
  classifyLines,
  mergeCandidates,
  scoreCoverage,
  reconcile as reconcileFields,
  readCodebaseCandidates,
  readPdf,
  readPptx,
  readXlsxCandidates,
  readImageCandidates,
  configureOcrFromEnvironment,
  readOpenApiCandidates,
  buildRecordedSessionInventory,
  readRecordedSession,
  genericProfile,
} from './dist/index.js'

const ROOT = await realpath(process.cwd())
configureOcrFromEnvironment(process.env)

const TOOLS = [
  { name: 'read_spec_document', description: 'Read one document (path relative to the confined root) into candidates.' },
  { name: 'inspect_recorded_session', description: 'Inspect a recorded-session directory and return its artifact inventory.' },
  { name: 'score_corpus', description: 'Score a corpus of candidates against a profile.' },
  { name: 'list_profiles', description: 'List available profiles.' },
  { name: 'reconcile', description: "Reconcile an old artifact's field list against a newer system's." },
]

async function resolveConfined(requestedPath) {
  const candidate = resolve(ROOT, requestedPath)
  if (!existsSync(candidate)) {
    throw new Error(`confinement: "${requestedPath}" does not exist under the confined root`)
  }
  const real = await realpath(candidate)
  if (real !== ROOT && !real.startsWith(ROOT + sep)) {
    throw new Error(`confinement: "${requestedPath}" resolves outside the confined root (symlink escape)`)
  }
  return real
}

async function callTool(name, args) {
  if (name === 'list_profiles') {
    return { profiles: [{ id: genericProfile.id, name: genericProfile.name }] }
  }
  if (name === 'read_spec_document') {
    const path = args?.path
    if (!path) throw new Error('read_spec_document requires "path"')
    const real = await resolveConfined(path)
    const bytes = await readFile(real)
    const ext = extname(real).toLowerCase()
    if (ext === '.pdf') {
      const pages = await readPdf(new Uint8Array(bytes))
      return { candidates: pages.flatMap((p) => classifyLines(p.lines, `${path}#page${p.page}`)) }
    }
    if (ext === '.pptx') {
      const slides = await readPptx(new Uint8Array(bytes))
      return { candidates: slides.flatMap((s) => classifyLines(s.lines, `${path}#slide${s.slide}`)) }
    }
    if (ext === '.xlsx') {
      return { candidates: await readXlsxCandidates(new Uint8Array(bytes), path) }
    }
    const imageCandidates = await readImageCandidates(new Uint8Array(bytes), path, { sourcePath: real })
    if (imageCandidates) return { candidates: imageCandidates }
    const openApiCandidates = readOpenApiCandidates(new Uint8Array(bytes), path)
    if (openApiCandidates) return { candidates: openApiCandidates }
    const text = bytes.toString('utf-8')
    return { candidates: [...readCodebaseCandidates(text, path), ...classifyLines(text.split(/\r\n|\r|\n/), path)] }
  }
  if (name === 'inspect_recorded_session') {
    const path = args?.path
    if (!path) throw new Error('inspect_recorded_session requires "path"')
    const real = await resolveConfined(path)
    const inventory = await buildRecordedSessionInventory(real)
    if (inventory.refusalReasons.length > 0) {
      return { inventory, refused: true }
    }
    return { inventory, candidates: await readRecordedSession(real) }
  }
  if (name === 'score_corpus') {
    const candidates = args?.candidates
    if (!Array.isArray(candidates)) throw new Error('score_corpus requires "candidates" (array)')
    const corpus = mergeCandidates(candidates)
    return { coverage: scoreCoverage(corpus, args?.profile ?? genericProfile) }
  }
  if (name === 'reconcile') {
    const { oldFields, newFields } = args ?? {}
    if (!Array.isArray(oldFields) || !Array.isArray(newFields)) {
      throw new Error('reconcile requires "oldFields" and "newFields" (arrays)')
    }
    return reconcileFields(oldFields, newFields)
  }
  throw new Error(`unknown tool: ${name}`)
}

const rl = createInterface({ input: process.stdin })

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

rl.on('line', (line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  if (msg.method === 'initialize') {
    respond(msg.id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'spec-ingest', version: '0.2.0' },
    })
  } else if (msg.method === 'tools/list') {
    respond(msg.id, { tools: TOOLS })
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params ?? {}
    callTool(name, args)
      .then((result) => {
        respond(msg.id, { content: [{ type: 'text', text: JSON.stringify(result) }], isError: false })
      })
      .catch((err) => {
        respond(msg.id, { content: [{ type: 'text', text: err?.message ?? String(err) }], isError: true })
      })
  }
  // notifications/initialized needs no response
})

