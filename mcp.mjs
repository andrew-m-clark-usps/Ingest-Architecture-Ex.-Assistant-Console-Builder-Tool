#!/usr/bin/env node
// DEMO/REFERENCE SCAFFOLD MCP server — see Spec-Ingest-Tool.md section 12.
// JSON-RPC over stdio, newline-delimited, no SDK. Four tools named in the
// brief; this scaffold only answers initialize/tools/list and stubs tools/call.
import { createInterface } from 'node:readline'

const TOOLS = [
  { name: 'read_spec_document', description: 'Read one document into candidates (scaffold: not implemented).' },
  { name: 'score_corpus', description: 'Score a corpus against a profile (scaffold: not implemented).' },
  { name: 'list_profiles', description: 'List available profiles.' },
  { name: 'reconcile', description: 'Reconcile an old artifact against a newer spec (scaffold: not implemented).' },
]

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
      serverInfo: { name: 'spec-ingest-scaffold', version: '0.1.0-demo' },
    })
  } else if (msg.method === 'tools/list') {
    respond(msg.id, { tools: TOOLS })
  } else if (msg.method === 'tools/call') {
    respond(msg.id, {
      content: [{ type: 'text', text: 'DEMO SCAFFOLD: not implemented. See Spec-Ingest-Tool.md.' }],
      isError: true,
    })
  }
  // notifications/initialized needs no response
})
