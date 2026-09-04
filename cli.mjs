#!/usr/bin/env node
// See Spec-Ingest-Tool.md section 11 (CLI). Run `npm run build` first --
// this reads the compiled output under dist/, not src/ directly.
import { readFile, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname } from 'node:path'
import {
  classifyLines,
  mergeCandidates,
  scoreCoverage,
  detectContradictions,
  readPdf,
  readPptx,
  genericProfile,
} from './dist/index.js'

const FLAGS_WITH_VALUES = new Set(['--require', '--profile'])
const BOOLEAN_FLAGS = new Set(['--coverage', '--conflicts'])

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

async function readCandidatesFromFile(path) {
  const bytes = await readFile(path)
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

async function main() {
  const { files: rawFiles, values, bools } = parseArgs(process.argv.slice(2))

  if (rawFiles.length === 0) {
    console.log('usage: spec-ingest <files or dir> [--coverage] [--conflicts] [--require <section>] [--profile <file>]')
    return 0
  }

  const missing = rawFiles.filter((f) => !existsSync(f))
  if (missing.length > 0) {
    for (const f of missing) console.error(`missing: ${f}`)
    return 1
  }

  const files = await expandFiles(rawFiles)
  const profile = await loadProfile(values['--profile'])
  const allCandidates = []
  for (const file of files) {
    allCandidates.push(...(await readCandidatesFromFile(file)))
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

  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err?.message ?? String(err))
    process.exit(1)
  })
