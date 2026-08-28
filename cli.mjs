#!/usr/bin/env node
// DEMO/REFERENCE SCAFFOLD CLI — see Spec-Ingest-Tool.md section 11.
// Not the full implementation: this only demonstrates the command shape.
import { existsSync } from 'node:fs'

function flag(name) {
  return process.argv.includes(`--${name}`)
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))

console.log('[spec-ingest] DEMO SCAFFOLD — not a full implementation.')
console.log('See Spec-Ingest-Tool.md for the complete brief.')

if (flag('coverage')) {
  console.log('coverage: (scaffold) no sources read')
  process.exit(0)
}

if (files.length === 0) {
  console.log('usage: spec-ingest <files or dir> [--coverage] [--require <section>] [--profile <file>]')
  process.exit(0)
}

for (const f of files) {
  console.log(existsSync(f) ? `would read: ${f}` : `missing: ${f}`)
}
