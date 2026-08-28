#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 11 (the CLI) and section 8A (the four-
// stories-and-no-arguments acceptance case). Reads whatever real readers
// this scaffold has (PDF, PPTX, XLSX, OpenAPI/Swagger, a codebase
// directory), classifies lines, merges them into a corpus, and reports
// coverage against the generic profile by default — no profile, no flags
// required for the basic path.
import { existsSync, readFileSync, statSync } from 'node:fs'
import {
  readPdf,
  readPptx,
  readXlsx,
  classifySpreadsheet,
  readZipEntries,
  parseOpenApiSource,
  isOpenApiDocument,
  classifyOpenApi,
  readCodebase,
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
  console.log('usage: spec-ingest <files-or-dirs...> [--coverage] [--no-ml]')
  console.log('See Spec-Ingest-Tool.md for the complete brief.')
  console.log('Reads: .pdf, .pptx, .xlsx, OpenAPI/Swagger (.json/.yaml), or a codebase directory.')
  process.exit(0)
}

// Claim by content, never by extension (section 8A): sniff the file's
// magic bytes (and, for a ZIP, its internal entries) rather than trusting
// its name.
function sniffKind(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf' // %PDF
  }
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    return 'zip' // PK.. — could be .pptx/.xlsx/.docx
  }
  const text = Buffer.from(bytes).toString('utf-8').trimStart()
  if (text.startsWith('{') || /^[\w-]+:/.test(text)) {
    return 'json-or-yaml' // claimed only if it turns out to declare openapi/swagger
  }
  return 'unknown'
}

async function sniffZipKind(bytes) {
  const entries = await readZipEntries(bytes)
  if (entries.some((e) => e.name.startsWith('ppt/slides/'))) return 'pptx'
  if (entries.some((e) => e.name.startsWith('xl/worksheets/'))) return 'xlsx'
  return 'unknown-zip'
}

const allCandidates = []

for (const f of files) {
  if (!existsSync(f)) {
    console.log(`missing: ${f}`)
    continue
  }

  if (statSync(f).isDirectory()) {
    try {
      const { candidates, filesRead, filesSkipped } = await readCodebase(f)
      allCandidates.push(...candidates)
      console.log(`read: ${f} (codebase, ${filesRead} file(s)${filesSkipped.length ? `, ${filesSkipped.length} unreadable` : ''})`)
    } catch (err) {
      console.log(`refused: ${f} — ${err.message}`)
    }
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
      const zipKind = await sniffZipKind(bytes)
      if (zipKind === 'pptx') {
        const slides = await readPptx(bytes)
        for (const slide of slides) {
          allCandidates.push(...classifyLines(slide.lines, `${f}#slide${slide.slide}`))
        }
        console.log(`read: ${f} (PPTX, ${slides.length} slide(s))`)
      } else if (zipKind === 'xlsx') {
        const sheets = await readXlsx(bytes)
        for (const sheet of sheets) {
          allCandidates.push(...classifySpreadsheet(sheet, f))
        }
        console.log(`read: ${f} (XLSX, ${sheets.length} sheet(s))`)
      } else {
        console.log(`skipped: ${f} (a ZIP, but not a .pptx or .xlsx this scaffold reads)`)
      }
    } else if (kind === 'json-or-yaml') {
      const text = Buffer.from(bytes).toString('utf-8')
      const isJson = text.trimStart().startsWith('{')
      let doc
      try {
        doc = parseOpenApiSource(text, isJson)
      } catch (err) {
        console.log(`skipped: ${f} (not readable as JSON/this YAML subset — ${err.message})`)
        continue
      }
      if (!isOpenApiDocument(doc)) {
        console.log(`skipped: ${f} (no "openapi"/"swagger" key — falls through to another reader, per section 6A)`)
        continue
      }
      const opCandidates = classifyOpenApi(doc, f)
      allCandidates.push(...opCandidates)
      console.log(`read: ${f} (OpenAPI/Swagger, ${opCandidates.filter((c) => c.kind === 'endpoint').length} operation(s))`)
    } else {
      console.log(`skipped: ${f} (unrecognized content)`)
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
