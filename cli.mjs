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
  readPdf,
  readPptx,
  genericProfile,
} from './dist/index.js'

const TOOL_VERSION = '0.2.0'
const FLAGS_WITH_VALUES = new Set(['--require', '--profile', '--write-brief'])
// --no-ml is accepted and logged but is currently a no-op: there is no
// inference path in this tool yet, so the deterministic output is always
// what runs. Once one exists, this flag must produce a byte-identical
// superset of the deterministic candidates (Spec-Ingest-Tool.md section 5).
const BOOLEAN_FLAGS = new Set(['--coverage', '--conflicts', '--no-ml'])

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
      for (const entry of await readdir(p)) result.push(`${p}/${entry}`)
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
  if (ext === '.pdf') {
    const pages = await readPdf(new Uint8Array(bytes))
    return pages.flatMap((p) => classifyLines(p.lines, `${path}#page${p.page}`))
  }
  if (ext === '.pptx') {
    const slides = await readPptx(new Uint8Array(bytes))
    return slides.flatMap((s) => classifyLines(s.lines, `${path}#slide${s.slide}`))
  }
  if (ext === '.xls') {
    throw new Error(`refused: ${path} -- legacy .xls binary format is not supported, only .xlsx`)
  }
  return classifyLines(bytes.toString('utf-8').split(/\r\n|\r|\n/), path)
}

// Every read is audited -- path, content hash, and byte count only, never
// the extracted text itself (Spec-Ingest-Tool.md section 13A). A refusal
// (a reader's guard firing) is logged too, since a naive logger drops
// exactly the entries someone eventually comes looking for.
async function readAndAudit(path, who) {
  const bytes = await readFile(path)
  const read = { path, contentHash: hashContent(bytes), byteCount: bytes.length }
  try {
    const candidates = await classifyBytes(path, bytes)
    await appendAuditRecord({ who, read })
    return candidates
  } catch (err) {
    await appendAuditRecord({ who, read, refusal: { reason: err?.message ?? String(err) } })
    throw err
  }
}

async function main() {
  const { files: rawFiles, values, bools } = parseArgs(process.argv.slice(2))

  if (rawFiles.length === 0) {
    console.log(
      'usage: spec-ingest <files or dir> [--coverage] [--conflicts] [--require <section>] ' +
        '[--profile <file>] [--write-brief <path>] [--no-ml]',
    )
    return 0
  }

  const missing = rawFiles.filter((f) => !existsSync(f))
  if (missing.length > 0) {
    for (const f of missing) console.error(`missing: ${f}`)
    return 1
  }

  const who = whoAmI()
  const files = await expandFiles(rawFiles)
  const profile = await loadProfile(values['--profile'])
  const allCandidates = []
  for (const file of files) {
    allCandidates.push(...(await readAndAudit(file, who)))
  }

  if (bools['--conflicts']) {
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

  const corpus = mergeCandidates(allCandidates)
  const coverage = scoreCoverage(corpus, profile)

  if (bools['--coverage']) {
    for (const report of coverage) {
      console.log(`${report.section}. ${report.title}: ${report.unreachable ? 'UNREACHABLE' : `${report.count} candidate(s)`}`)
    }
  }

  if (values['--require']) {
    const required = coverage.find((r) => r.section === values['--require'])
    if (!required || required.unreachable) {
      console.error(`refused: required section "${values['--require']}" is unreachable`)
      return 1
    }
  }

  if (values['--write-brief']) {
    // Scan for credential shapes before writing -- refuse, naming the
    // source and which shape matched, rather than redacting silently.
    const findings = scanForCredentials(allCandidates)
    if (findings.length > 0) {
      for (const f of findings) console.error(`refused to write: ${f.ref} matches credential shape "${f.shape}"`)
      await appendAuditRecord({ who, refusal: { reason: `credential shape(s) found: ${findings.map((f) => f.shape).join(', ')}` } })
      return 1
    }
    const briefJson = JSON.stringify(
      { profile: profile.id, coverage, candidateCount: corpus.candidates.length },
      null,
      2,
    )
    await writeFile(values['--write-brief'], briefJson, 'utf-8')
    await appendAuditRecord({
      who,
      against: { profileId: profile.id, toolVersion: TOOL_VERSION },
      produced: { contentHash: hashContent(briefJson), sections: coverage.filter((c) => !c.unreachable).map((c) => c.section) },
    })
    console.log(`wrote ${values['--write-brief']}`)
  }

  return 0
}


main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err?.message ?? String(err))
    process.exit(1)
  })
