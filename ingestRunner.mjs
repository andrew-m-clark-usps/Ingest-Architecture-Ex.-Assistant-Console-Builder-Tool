// Shell-level orchestration shared by cli.mjs and ui/server.mjs. This file
// is deliberately NOT under src/: the core library in src/ is a pure
// function-over-bytes package with no filesystem access (Spec-Ingest-Tool.md
// section 1A), while this module is the filesystem-touching "shell" that
// claims each path by content and hands bytes to that core. Two shells
// (a terminal, a browser) share this one orchestration path instead of each
// re-implementing the sniff-and-read loop, so a fix here reaches both.
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

// Claim by content, never by extension (section 8A): sniff the file's
// magic bytes (and, for a ZIP, its internal entries) rather than trusting
// its name.
export function sniffKind(bytes) {
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

export async function sniffZipKind(bytes) {
  const entries = await readZipEntries(bytes)
  if (entries.some((e) => e.name.startsWith('ppt/slides/'))) return 'pptx'
  if (entries.some((e) => e.name.startsWith('xl/worksheets/'))) return 'xlsx'
  return 'unknown-zip'
}

/**
 * Reads each path (file or directory), claiming it by content, and returns
 * a structured report plus the merged corpus/coverage/contradictions — the
 * same information cli.mjs prints as text and ui/server.mjs renders as HTML.
 *
 * @param {string[]} paths
 * @returns {Promise<{ fileReports: Array<{ path: string, status: 'read'|'skipped'|'refused'|'missing', detail: string }>, corpus: unknown, coverage: unknown }>}
 */
export async function ingestPaths(paths) {
  const fileReports = []
  const allCandidates = []

  for (const f of paths) {
    if (!existsSync(f)) {
      fileReports.push({ path: f, status: 'missing', detail: '' })
      continue
    }

    if (statSync(f).isDirectory()) {
      try {
        const { candidates, filesRead, filesSkipped } = await readCodebase(f)
        allCandidates.push(...candidates)
        fileReports.push({
          path: f,
          status: 'read',
          detail: `codebase, ${filesRead} file(s)${filesSkipped.length ? `, ${filesSkipped.length} unreadable` : ''}`,
        })
      } catch (err) {
        fileReports.push({ path: f, status: 'refused', detail: err.message })
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
        fileReports.push({ path: f, status: 'read', detail: `PDF, ${pages.length} page(s)` })
      } else if (kind === 'zip') {
        const zipKind = await sniffZipKind(bytes)
        if (zipKind === 'pptx') {
          const slides = await readPptx(bytes)
          for (const slide of slides) {
            allCandidates.push(...classifyLines(slide.lines, `${f}#slide${slide.slide}`))
          }
          fileReports.push({ path: f, status: 'read', detail: `PPTX, ${slides.length} slide(s)` })
        } else if (zipKind === 'xlsx') {
          const sheets = await readXlsx(bytes)
          for (const sheet of sheets) {
            allCandidates.push(...classifySpreadsheet(sheet, f))
          }
          fileReports.push({ path: f, status: 'read', detail: `XLSX, ${sheets.length} sheet(s)` })
        } else {
          fileReports.push({ path: f, status: 'skipped', detail: 'a ZIP, but not a .pptx or .xlsx this scaffold reads' })
        }
      } else if (kind === 'json-or-yaml') {
        const text = Buffer.from(bytes).toString('utf-8')
        const isJson = text.trimStart().startsWith('{')
        let doc
        try {
          doc = parseOpenApiSource(text, isJson)
        } catch (err) {
          fileReports.push({ path: f, status: 'skipped', detail: `not readable as JSON/this YAML subset — ${err.message}` })
          continue
        }
        if (!isOpenApiDocument(doc)) {
          fileReports.push({ path: f, status: 'skipped', detail: 'no "openapi"/"swagger" key — falls through to another reader, per section 6A' })
          continue
        }
        const opCandidates = classifyOpenApi(doc, f)
        allCandidates.push(...opCandidates)
        fileReports.push({
          path: f,
          status: 'read',
          detail: `OpenAPI/Swagger, ${opCandidates.filter((c) => c.kind === 'endpoint').length} operation(s)`,
        })
      } else {
        fileReports.push({ path: f, status: 'skipped', detail: 'unrecognized content' })
      }
    } catch (err) {
      fileReports.push({ path: f, status: 'refused', detail: err.message })
    }
  }

  const corpus = mergeCandidates(allCandidates)
  const coverage = scoreCoverage(corpus, genericProfile)
  return { fileReports, corpus, coverage }
}

export { genericProfile }
