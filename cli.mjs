#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 11 (the CLI) and section 8A (the four-
// stories-and-no-arguments acceptance case). Reads whatever real readers
// this scaffold has (PDF, PPTX, XLSX, OpenAPI/Swagger, a codebase
// directory), classifies lines, merges them into a corpus, and reports
// coverage against the generic profile by default — no profile, no flags
// required for the basic path.
//
// The actual sniff-and-read loop lives in ingestRunner.mjs, shared with
// ui/server.mjs, so the two shells (terminal, browser) can never drift
// from each other on what counts as "read" vs. "skipped" vs. "refused".
import { ingestPaths, genericProfile } from './ingestRunner.mjs'

function flag(name) {
  return process.argv.includes(`--${name}`)
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  console.log('usage: spec-ingest <files-or-dirs...> [--coverage] [--no-ml]')
  console.log('See Spec-Ingest-Tool.md for the complete brief.')
  console.log('Reads: .pdf, .pptx, .xlsx, OpenAPI/Swagger (.json/.yaml), or a codebase directory.')
  process.exit(0)
}

const { fileReports, corpus, coverage } = await ingestPaths(files)

for (const r of fileReports) {
  if (r.status === 'missing') {
    console.log(`missing: ${r.path}`)
  } else if (r.status === 'read') {
    console.log(`read: ${r.path} (${r.detail})`)
  } else if (r.status === 'skipped') {
    console.log(`skipped: ${r.path} (${r.detail})`)
  } else {
    console.log(`refused: ${r.path} — ${r.detail}`)
  }
}

if (flag('coverage') || true) {
  console.log('\ncoverage:')
  for (const section of coverage) {
    const status = section.count > 0 ? `${section.count} candidate(s)` : section.unreachable ? 'unreachable' : `empty — ${genericProfile.sections.find((s) => s.section === section.section)?.fill}`
    console.log(`  ${section.section}. ${section.title}: ${status}`)
  }
}

if (corpus.contradictions.length > 0) {
  console.log('\ncontradictions (silence is not agreement — this is only what was detectable):')
  for (const c of corpus.contradictions) {
    console.log(`  [${c.kind}] ${c.claims.map((claim) => `${claim.value} (${claim.ref})`).join(' vs. ')}`)
  }
}

