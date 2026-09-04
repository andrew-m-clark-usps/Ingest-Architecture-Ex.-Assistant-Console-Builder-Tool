#!/usr/bin/env node
// See ../Console.md section 8: the verified external URL directory is
// re-checked by a script that exits non-zero on a broken link. Reads the
// URLs straight out of lib/referenceData.ts by regex (no TS runtime
// needed) so there is exactly one place the URL list lives.
import { readFile } from 'node:fs/promises'

const REFERENCE_DATA_PATH = 'src/lib/referenceData.ts'
const TIMEOUT_MS = 20_000

async function extractUrls() {
  const text = await readFile(REFERENCE_DATA_PATH, 'utf-8')
  const matches = [...text.matchAll(/url:\s*'([^']+)'/g)]
  return [...new Set(matches.map((m) => m[1]))]
}

async function checkUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal })
    if (!res.ok) {
      // Some servers don't support HEAD -- retry with GET before failing.
      res = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal })
    }
    return { url, ok: res.ok, status: res.status }
  } catch (err) {
    return { url, ok: false, status: 0, error: err?.message ?? String(err) }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const urls = await extractUrls()
  if (urls.length === 0) {
    console.error(`refused: no URLs found in ${REFERENCE_DATA_PATH}`)
    process.exit(1)
  }

  const results = await Promise.all(urls.map(checkUrl))
  for (const r of results) {
    console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.status || '---'} ${r.url}${r.error ? ` (${r.error})` : ''}`)
  }

  const broken = results.filter((r) => !r.ok)
  if (broken.length > 0) {
    console.error(`${broken.length} of ${urls.length} reference URL(s) failed`)
    process.exit(1)
  }
  console.log(`all ${urls.length} reference URLs verified`)
}

main()
