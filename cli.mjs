#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 11 (CLI). Run `npm run build` first --
// this reads the compiled output under dist/, not src/ directly.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname } from 'node:path'
import {
  classifyLines,
  mergeCandidates,
  scoreCoverage,
  detectContradictions,
  scanForCredentials,
  appendAuditRecord,
  hashContent,
  readCodebaseCandidates,
  readPdf,
  readPptx,
  detectMarking,
  mergeMarkings,
  readXlsxCandidates,
  readImageCandidates,
  genericProfile,
  generateApplication,
  readOpenApiCandidates,
  buildRecordedSessionInventory,
  readRecordedSession,
  writeGeneratedFiles,
} from './dist/index.js'

const TOOL_VERSION = '0.2.0'
const FLAGS_WITH_VALUES = new Set(['--require', '--profile', '--write-brief', '--generate', '--confirm-marked-output'])
// --no-ml is accepted and logged but is currently a no-op: there is no
// inference path in this tool yet, so the deterministic output is always
// what runs. Once one exists, this flag must produce a byte-identical
// superset of the deterministic candidates (Spec-Ingest-Tool.md section 5).
const BOOLEAN_FLAGS = new Set(['--coverage', '--conflicts', '--no-ml', '--inventory'])
const SESSION_ARTIFACT_NAMES = new Set(['meta.json', 'fields.json', 'ax-tree.json', 'styles.json', 'requests.json', 'network.json', 'har.json'])

function whoAmI() {
  return process.env.USER || process.env.USERNAME || 'cli'
}

// Flag-value parsing that never uses `i !== flagIndex + 1` -- when a flag
// is absent, `indexOf` returns -1, and -1 + 1 === 0 would silently drop
// the first positional argument. This walks the array once instead,
// consuming a flag's value token explicitly as it's encountered.
function parseArgs(argv) {
  const files = []
  const values = {}
  const bools = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (FLAGS_WITH_VALUES.has(arg)) {
      const value = argv[i + 1]
      if (value === undefined) throw new Error(`refused: ${arg} requires a value`)
      values[arg] = value
      i++
      continue
    }
    if (BOOLEAN_FLAGS.has(arg)) {
      bools[arg] = true
      continue
    }
    if (arg.startsWith('--')) throw new Error(`refused: unknown flag ${arg}`)
    files.push(arg)
  }
  return { files, values, bools }
}

async function expandFiles(paths) {
  const result = []
  for (const p of paths) {
    const stats = await stat(p)
    if (stats.isDirectory()) {
      const entries = await readdir(p)
      if (entries.some((entry) => SESSION_ARTIFACT_NAMES.has(entry))) {
        result.push(p)
      } else {
        for (const entry of entries) result.push(`${p}/${entry}`)
      }
    } else {
      result.push(p)
    }
  }
  return result
}

async function loadProfile(path) {
  if (!path) return genericProfile
  return JSON.parse(await readFile(path, 'utf-8'))
}

async function classifyBytes(path, bytes) {
  const ext = extname(path).toLowerCase()
  const text = bytes.toString('utf-8')
  if (ext === '.pdf') {
    const pages = await readPdf(new Uint8Array(bytes))
    const lines = pages.flatMap((p) => p.lines)
    return { candidates: pages.flatMap((p) => classifyLines(p.lines, `${path}#page${p.page}`)), classification: detectMarking(lines) }
  }
  if (ext === '.pptx') {
    const slides = await readPptx(new Uint8Array(bytes))
    const lines = slides.flatMap((s) => s.lines)
    return { candidates: slides.flatMap((s) => classifyLines(s.lines, `${path}#slide${s.slide}`)), classification: detectMarking(lines) }
  }
  if (ext === '.xlsx') {
    const candidates = await readXlsxCandidates(new Uint8Array(bytes), path)
    return { candidates, classification: detectMarking(candidates.map((candidate) => candidate.text)) }
  }
  if (ext === '.xls') {
    throw new Error(`refused: ${path} -- legacy .xls binary format is not supported, only .xlsx`)
  }
  const imageCandidates = await readImageCandidates(new Uint8Array(bytes), path)
  if (imageCandidates) return { candidates: imageCandidates, classification: detectMarking(imageCandidates.map((candidate) => candidate.text)) }
  const openApiCandidates = readOpenApiCandidates(new Uint8Array(bytes), path)
  if (openApiCandidates) return { candidates: openApiCandidates, classification: detectMarking(openApiCandidates.map((candidate) => candidate.text)) }
  const codebaseCandidates = readCodebaseCandidates(text, path)
  const lines = text.split(/\r\n|\r|\n/)
  return { candidates: [...codebaseCandidates, ...classifyLines(lines, path)], classification: detectMarking(lines) }
}

// Every read is audited -- path, content hash, and byte count only, never
// the extracted text itself (Spec-Ingest-Tool.md section 13A). A refusal
// (a reader's guard firing) is logged too, since a naive logger drops
// exactly the entries someone eventually comes looking for.
async function readAndAudit(path, who) {
  const stats = await stat(path)
  if (stats.isDirectory()) {
    const inventory = await buildRecordedSessionInventory(path)
    const classification = detectMarking(inventory.artifacts.map((artifact) => artifact.path))
    const read = {
      path,
      contentHash: hashContent(inventory.artifacts.map((artifact) => `${artifact.path}:${artifact.contentHash}`).join('\n')),
      byteCount: inventory.artifacts.reduce((sum, artifact) => sum + artifact.byteCount, 0),
      classification,
    }
    try {
      if (inventory.refusalReasons.length > 0) {
        throw new Error(`refused: captured artifact contains sensitive value(s): ${inventory.refusalReasons.join(' | ')}`)
      }
      const candidates = await readRecordedSession(path)
      await appendAuditRecord({ who, read })
      return { candidates, classification }
    } catch (err) {
      await appendAuditRecord({ who, read, refusal: { reason: err?.message ?? String(err) } })
      throw err
    }
  }

  const bytes = await readFile(path)
  const classified = await classifyBytes(path, bytes)
  const read = { path, contentHash: hashContent(bytes), byteCount: bytes.length, classification: classified.classification }
  try {
    await appendAuditRecord({ who, read })
    return classified
  } catch (err) {
    await appendAuditRecord({ who, read, refusal: { reason: err?.message ?? String(err) } })
    throw err
  }
}

function reportConflicts(allCandidates) {
  const contradictions = detectContradictions(allCandidates)
  if (contradictions.length === 0) {
    console.log('no contradictions found')
  } else {
    for (const c of contradictions) {
      console.log(`CONTRADICTION (${c.because}):`)
      console.log(`  ${c.a.ref}: ${c.a.text}`)
      console.log(`  ${c.b.ref}: ${c.b.text}`)
    }
  }
  return contradictions.length > 0 ? 1 : 0
}

function formatCoverageLine(report) {
  const status = report.unreachable ? 'UNREACHABLE' : `${report.count} candidate(s)`
  return `${report.section}. ${report.title}: ${status}`
}

function printCoverage(coverage) {
  for (const report of coverage) console.log(formatCoverageLine(report))
}

function checkRequiredSection(coverage, requiredSection) {
  const required = coverage.find((r) => r.section === requiredSection)
  if (!required || required.unreachable) {
    console.error(`refused: required section "${requiredSection}" is unreachable`)
    return 1
  }
  return 0
}

// Scan for credential shapes before writing a brief or generating an
// app -- refuse, naming the source and which shape matched, rather than
// redacting silently. Returns undefined when clean, or the exit code to
// return immediately when refused.
async function refuseIfCredentialsFound(allCandidates, who, verb) {
  const findings = scanForCredentials(allCandidates)
  if (findings.length === 0) return undefined
  for (const f of findings) console.error(`refused to ${verb}: ${f.ref} matches credential shape "${f.shape}"`)
  await appendAuditRecord({ who, refusal: { reason: `credential shape(s) found: ${findings.map((f) => f.shape).join(', ')}` } })
  return 1
}

async function handleWriteBrief(outPath, allReadResults, corpus, coverage, profile, who, confirmedPath) {
  const classification = mergeMarkings(allReadResults.map((result) => result.classification))
  if (classification && confirmedPath !== outPath) {
    console.error(`refused: marked output ${classification} requires --confirm-marked-output ${outPath}`)
    return 1
  }
  const refusal = await refuseIfCredentialsFound(allReadResults.flatMap((result) => result.candidates), who, 'write')
  if (refusal !== undefined) return refusal

  const briefJson = JSON.stringify({ classification, profile: profile.id, coverage, candidateCount: corpus.candidates.length }, null, 2)
  await writeFile(outPath, briefJson, 'utf-8')
  await appendAuditRecord({
    who,
    against: { profileId: profile.id, toolVersion: TOOL_VERSION },
    produced: { contentHash: hashContent(briefJson), sections: coverage.filter((c) => !c.unreachable).map((c) => c.section), classification },
  })
  console.log(`wrote ${outPath}`)
  return 0
}

async function handleGenerate(outDir, allReadResults, corpus, profile, who, confirmedPath) {
  const classification = mergeMarkings(allReadResults.map((result) => result.classification))
  if (classification && confirmedPath !== outDir) {
    console.error(`refused: marked output ${classification} requires --confirm-marked-output ${outDir}`)
    return 1
  }
  const refusal = await refuseIfCredentialsFound(allReadResults.flatMap((result) => result.candidates), who, 'generate')
  if (refusal !== undefined) return refusal

  const { files } = generateApplication(corpus, profile, { classification })
  await writeGeneratedFiles(outDir, files)
  await appendAuditRecord({
    who,
    against: { profileId: profile.id, toolVersion: TOOL_VERSION },
    produced: { contentHash: hashContent(files.map((f) => f.path).join('\n')), sections: files.map((f) => f.path), classification },
  })
  console.log(`generated ${files.length} file(s) in ${outDir}`)
  return 0
}

async function collectAllCandidates(files, who) {
  const allCandidates = []
  for (const file of files) {
    allCandidates.push(await readAndAudit(file, who))
  }
  return allCandidates
}

async function handleInventory(paths, who) {
  const inventories = []
  let hasRefusal = false

  for (const path of paths) {
    const stats = await stat(path)
    if (!stats.isDirectory()) {
      console.error(`refused: ${path} is not a recorded-session directory`)
      hasRefusal = true
      continue
    }

    const inventory = await buildRecordedSessionInventory(path)
    inventories.push(inventory)
    const read = {
      path,
      contentHash: hashContent(inventory.artifacts.map((artifact) => `${artifact.path}:${artifact.contentHash}`).join('\n')),
      byteCount: inventory.artifacts.reduce((sum, artifact) => sum + artifact.byteCount, 0),
    }
    if (inventory.refusalReasons.length > 0) {
      hasRefusal = true
      await appendAuditRecord({ who, read, refusal: { reason: `inventory refusal: ${inventory.refusalReasons.join(' | ')}` } })
    } else {
      await appendAuditRecord({ who, read })
    }
  }

  console.log(JSON.stringify(inventories, null, 2))
  return hasRefusal ? 1 : 0
}

function reportMissingFiles(rawFiles) {
  const missing = rawFiles.filter((f) => !existsSync(f))
  if (missing.length === 0) return undefined

  for (const f of missing) console.error(`missing: ${f}`)
  return 1
}

async function main() {
  const { files: rawFiles, values, bools } = parseArgs(process.argv.slice(2))

  if (rawFiles.length === 0) {
    console.log(
      'usage: spec-ingest <files or dir> [--coverage] [--conflicts] [--inventory] [--require <section>] ' +
        '[--profile <file>] [--write-brief <path>] [--generate <dir>] [--confirm-marked-output <path>] [--no-ml]',
    )
    return 0
  }

  const missingCode = reportMissingFiles(rawFiles)
  if (missingCode !== undefined) return missingCode

  const who = whoAmI()
  const files = await expandFiles(rawFiles)
  if (bools['--inventory']) return handleInventory(files, who)

  const profile = await loadProfile(values['--profile'])
  const allReadResults = await collectAllCandidates(files, who)
  const allCandidates = allReadResults.flatMap((result) => result.candidates)

  if (bools['--conflicts']) return reportConflicts(allCandidates)

  const corpus = mergeCandidates(allCandidates)
  const coverage = scoreCoverage(corpus, profile)

  if (bools['--coverage']) printCoverage(coverage)

  if (values['--require']) {
    const code = checkRequiredSection(coverage, values['--require'])
    if (code !== 0) return code
  }

  if (values['--write-brief']) {
    const code = await handleWriteBrief(values['--write-brief'], allReadResults, corpus, coverage, profile, who, values['--confirm-marked-output'])
    if (code !== 0) return code
  }

  if (values['--generate']) {
    const code = await handleGenerate(values['--generate'], allReadResults, corpus, profile, who, values['--confirm-marked-output'])
    if (code !== 0) return code
  }

  return 0
}

try {
  process.exit(await main())
} catch (err) {
  console.error(err?.message ?? String(err))
  process.exit(1)
}
