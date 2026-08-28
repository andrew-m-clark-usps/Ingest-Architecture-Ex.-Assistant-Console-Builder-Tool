#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 11 (the CLI) and section 8A (the four-
// stories-and-no-arguments acceptance case). Reads whatever real readers
// this scaffold has (PDF, PPTX), classifies lines, merges them into a
// corpus, and reports coverage against the generic profile by default —
// no profile, no flags required for the basic path.
import { existsSync, readFileSync } from 'node:fs'
import {
  readPdf,
  readPptx,
  classifyLines,
  mergeCandidates,
  scoreCoverage,
  genericProfile,
} from './dist/index.js'

function flag(name) {
  return process.argv.includes(`--${name}`)
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'))

if (files.length === 0) {
  console.log('usage: spec-ingest <files...> [--coverage] [--no-ml]')
  console.log('See Spec-Ingest-Tool.md for the complete brief. This scaffold reads .pdf and .pptx.')
  process.exit(0)
}

// Claim by content, never by extension (section 8A): sniff the file's
// magic bytes rather than trusting its name.
function sniffKind(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf' // %PDF
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return 'zip' // PK.. — could be .pptx/.xlsx/.docx; this scaffold only reads .pptx content
  }
  return 'unknown'
}

const allCandidates = []

for (const f of files) {
  if (!existsSync(f)) {
    console.log(`missing: ${f}`)
    continue
  }
  const bytes = new Uint8Array(readFileSync(f))
  const kind = sniffKind(bytes)
  try {
    if (kind === 'pdf') {
      const pages = await readPdf(bytes)
      for (const page of pages) {
        allCandidates.push(...classifyLines(page.lines, `${f}#page${page.page}`))
      }
      console.log(`read: ${f} (PDF, ${pages.length} page(s))`)
    } else if (kind === 'zip') {
      const slides = await readPptx(bytes)
      for (const slide of slides) {
        allCandidates.push(...classifyLines(slide.lines, `${f}#slide${slide.slide}`))
      }
      console.log(`read: ${f} (PPTX, ${slides.length} slide(s))`)
    } else {
      console.log(`skipped: ${f} (unrecognized content — not a .pdf or .pptx this scaffold reads)`)
    }
  } catch (err) {
    console.log(`refused: ${f} — ${err.message}`)
  }
}

const corpus = mergeCandidates(allCandidates)

if (flag('coverage') || true) {
  const report = scoreCoverage(corpus, genericProfile)
  console.log('\ncoverage:')
  for (const section of report) {
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
