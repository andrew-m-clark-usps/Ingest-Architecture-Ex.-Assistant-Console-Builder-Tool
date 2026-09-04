#!/usr/bin/env node
// See ../Console.md section 5 (quality gates): grep the built dist/ for
// type="password", fetch(, XMLHttpRequest, and any AI SDK -- all absent.
//
// Source is checked for fetch(/XMLHttpRequest rather than the built
// dist/ bundle: Vite's own modulepreload polyfill legitimately calls
// fetch() to load other same-origin JS chunks, which is not a network
// call to a backend or third-party API and would otherwise be a
// permanent false positive in every Vite build. Checking our own source
// instead verifies the thing the invariant actually cares about: this
// app's code never calls a network API.
import { readdir, readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { pathToFileURL } from 'node:url'

const AI_SDK_NAMES = ['openai', '@anthropic-ai', 'cohere-ai', '@google/generative-ai', 'langchain']

async function walk(dir, extensions) {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...(await walk(full, extensions)))
    } else if (extensions.includes(extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

export async function checkSource(srcDir) {
  const failures = []
  for (const file of await walk(srcDir, ['.ts', '.tsx'])) {
    const text = await readFile(file, 'utf-8')
    if (/\bfetch\s*\(/.test(text)) failures.push(`${file}: calls fetch(...) -- this product is browser-only, no backend`)
    if (/\bXMLHttpRequest\b/.test(text)) failures.push(`${file}: uses XMLHttpRequest -- this product is browser-only, no backend`)
    if (/type=["']password["']/.test(text)) failures.push(`${file}: has a type="password" field -- never collect a real password`)
    for (const name of AI_SDK_NAMES) {
      if (text.includes(name)) failures.push(`${file}: references AI SDK "${name}"`)
    }
  }
  return failures
}

export async function checkDist(distDir) {
  const failures = []
  for (const file of await walk(distDir, ['.html', '.js'])) {
    const text = await readFile(file, 'utf-8')
    if (/type=["']password["']/.test(text)) failures.push(`${file}: built output has a type="password" field`)
    for (const name of AI_SDK_NAMES) {
      if (text.toLowerCase().includes(name.toLowerCase())) failures.push(`${file}: built output references AI SDK "${name}"`)
    }
  }
  return failures
}

async function main() {
  const failures = [...(await checkSource('src')), ...(await checkDist('dist'))]
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAIL: ${f}`)
    process.exit(1)
  }
  console.log('check:dist -- no password field, fetch/XHR in source, or AI SDK reference found')
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
