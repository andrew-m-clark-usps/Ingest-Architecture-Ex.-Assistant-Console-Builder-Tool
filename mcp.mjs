#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 12 (the MCP server). JSON-RPC over
// stdio, newline-delimited, no SDK. Four narrow tools: nothing writes a
// file or reaches the network, and reading a document the caller names is
// the whole capability — that is what makes it safe to hand to an agent.
// A refusal (e.g. "this PDF is a scan") is returned as a tool result with
// isError: true, never as a transport error.
import { createInterface } from 'node:readline'
import { readFileSync } from 'node:fs'
import {
  readPdf,
  readPptx,
  classifyLines,
  mergeCandidates,
  scoreCoverage,
  reconcile,
  genericProfile,
} from './dist/index.js'

const PROFILES = { generic: genericProfile }

const TOOLS = [
  { name: 'read_spec_document', description: 'Read one document (.pdf or .pptx) into classified candidates.' },
  { name: 'score_corpus', description: 'Classify one or more documents and score coverage against a profile.' },
  { name: 'list_profiles', description: 'List available profiles.' },
  { name: 'reconcile', description: 'Reconcile an old artifact\'s field labels against a newer system\'s.' },
]

const rl = createInterface({ input: process.stdin })

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true }
}

async function readDocument(path) {
  const bytes = new Uint8Array(readFileSync(path))
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    const pages = await readPdf(bytes)
    return pages.flatMap((p) => classifyLines(p.lines, `${path}#page${p.page}`))
  }
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const slides = await readPptx(bytes)
    return slides.flatMap((s) => classifyLines(s.lines, `${path}#slide${s.slide}`))
  }
  throw new Error(`unrecognized content at ${path} — this scaffold reads .pdf and .pptx only`)
}

async function callTool(name, args) {
  if (name === 'read_spec_document') {
    const candidates = await readDocument(args.path)
    return { content: [{ type: 'text', text: JSON.stringify(candidates, null, 2) }] }
  }
  if (name === 'score_corpus') {
    const allCandidates = []
    for (const path of args.paths ?? []) {
      allCandidates.push(...(await readDocument(path)))
    }
    const corpus = mergeCandidates(allCandidates)
    const profile = PROFILES[args.profile ?? 'generic']
    if (!profile) throw new Error(`unknown profile "${args.profile}"`)
    const report = scoreCoverage(corpus, profile)
    return {
      content: [
        { type: 'text', text: JSON.stringify({ coverage: report, contradictions: corpus.contradictions }, null, 2) },
      ],
    }
  }
  if (name === 'list_profiles') {
    return { content: [{ type: 'text', text: JSON.stringify(Object.keys(PROFILES)) }] }
  }
  if (name === 'reconcile') {
    const result = reconcile(args.oldFields ?? [], args.newFields ?? [], args.synonyms ?? {})
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  }
  throw new Error(`unknown tool "${name}"`)
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
      serverInfo: { name: 'spec-ingest-scaffold', version: '0.1.0-demo' },
    })
  } else if (msg.method === 'tools/list') {
    respond(msg.id, { tools: TOOLS })
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params ?? {}
    callTool(name, args ?? {})
      .then((result) => respond(msg.id, result))
      .catch((err) => respond(msg.id, toolError(err.message)))
  }
  // notifications/initialized needs no response
})
