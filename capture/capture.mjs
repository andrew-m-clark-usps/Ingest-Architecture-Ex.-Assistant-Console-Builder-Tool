#!/usr/bin/env node
// See ../Spec-Ingest-Tool.md section 5E ("Capturing a running system with
// Playwright"). Runs on Node at capture time only; ships in nothing (see
// section 2/7A). Writes one directory per route in the shape journalSpec.ts
// (in the core package) already reads: meta.json, fields.json, ax-tree.json,
// styles.json — plus network.json, console.json, and screenshot.png.
//
// NOT independently browser-tested in this repository: the sandboxed
// environment this was written in cannot download a Chromium binary
// (`npx playwright install chromium` fails with a corporate proxy 403).
// The Playwright API calls below are correct against the documented API
// (page.accessibility.snapshot(), not the brief's informally-named
// "page.accessibleSnapshot()" — a real defect this repo's own convention
// is to record, not silently "fix" without noting it). The redaction and
// structure-summarization logic they depend on IS unit tested — see
// redact.mjs and redact.test.mjs — since that logic has no browser
// dependency. Run `npm run capture -- <url> <outDir>` yourself once
// Chromium is installed to confirm the live-browser path end to end
// before relying on it.

import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { summarizeExchange, dropQueryString } from './redact.mjs'

const STORAGE_STATE_PATH = process.env.SPEC_INGEST_STORAGE_STATE ?? '.auth/storageState.json'

const STYLE_TOKEN_SELECTORS = ['body', 'h1', 'h2', 'button', 'a', 'input']
const UNHAPPY_PATH_PROBES = [
  { label: 'submit-empty', fill: () => ({}) },
  { label: 'field-over-length', fill: (name) => ({ [name]: 'x'.repeat(500) }) },
]

async function captureAccessibility(page) {
  // The real API is page.accessibility.snapshot() -- not
  // "page.accessibleSnapshot()" as informally named in the brief text.
  const snapshot = await page.accessibility.snapshot()
  const names = []
  function walk(node) {
    if (!node) return
    if (node.name) names.push({ name: node.name, role: node.role })
    for (const child of node.children ?? []) walk(child)
  }
  walk(snapshot)
  return names
}

async function captureFormStructure(page) {
  return page.evaluate(() => {
    const controls = [...document.querySelectorAll('input, select, textarea')]
    return controls.map((el) => ({
      name: el.getAttribute('name') || el.getAttribute('id') || '',
      type: el.getAttribute('type') || el.tagName.toLowerCase(),
      required: el.hasAttribute('required'),
      maxlength: el.getAttribute('maxlength'),
      pattern: el.getAttribute('pattern'),
      options:
        el.tagName.toLowerCase() === 'select'
          ? [...el.querySelectorAll('option')].map((o) => o.value)
          : undefined,
    }))
  })
}

async function captureComputedStyles(page) {
  return page.evaluate((selectors) => {
    const tokens = {}
    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (!el) continue
      const computed = getComputedStyle(el)
      tokens[`${selector}.color`] = computed.color
      tokens[`${selector}.fontSize`] = computed.fontSize
      tokens[`${selector}.fontWeight`] = computed.fontWeight
      tokens[`${selector}.margin`] = computed.margin
      tokens[`${selector}.padding`] = computed.padding
    }
    return tokens
  }, STYLE_TOKEN_SELECTORS)
}

async function captureRoute(context, baseUrl, route, stepDir) {
  await mkdir(stepDir, { recursive: true })

  const page = await context.newPage()
  const exchanges = []
  const consoleMessages = []
  const pageErrors = []

  page.on('request', (request) => {
    request._capturedAt = Date.now()
  })
  page.on('response', async (response) => {
    const request = response.request()
    let requestBody
    try {
      requestBody = request.postData()
    } catch {
      requestBody = undefined
    }
    let responseBody
    try {
      const contentType = response.headers()['content-type'] ?? ''
      if (contentType.includes('json')) responseBody = await response.text()
    } catch {
      responseBody = undefined
    }
    exchanges.push(
      summarizeExchange({
        url: response.url(),
        method: request.method(),
        requestHeaders: request.headers(),
        requestBody,
        status: response.status(),
        responseHeaders: response.headers(),
        responseBody,
      }),
    )
  })
  page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }))
  page.on('pageerror', (err) => pageErrors.push(String(err)))

  const url = new URL(route, baseUrl).toString()
  await page.goto(url, { waitUntil: 'networkidle' })

  const title = await page.title()
  const axNames = await captureAccessibility(page)
  const fields = await captureFormStructure(page)
  const styles = await captureComputedStyles(page)
  await page.screenshot({ path: join(stepDir, 'screenshot.png'), fullPage: true })

  // Provoke the unhappy paths deliberately: empty submit, an over-length
  // field. Never against production -- the caller points baseUrl at a
  // test environment.
  for (const probe of UNHAPPY_PATH_PROBES) {
    for (const field of fields) {
      if (!field.name) continue
      try {
        const values = probe.fill(field.name)
        for (const [name, value] of Object.entries(values)) {
          await page.fill(`[name="${name}"]`, value).catch(() => {})
        }
        await page.click('button[type="submit"]').catch(() => {})
      } catch {
        // A probe that cannot run on this page is not a capture failure.
      }
    }
  }

  await writeFile(
    join(stepDir, 'meta.json'),
    JSON.stringify({ route: dropQueryString(route), title }, null, 2),
  )
  await writeFile(join(stepDir, 'fields.json'), JSON.stringify(fields, null, 2))
  await writeFile(join(stepDir, 'ax-tree.json'), JSON.stringify(axNames, null, 2))
  await writeFile(join(stepDir, 'styles.json'), JSON.stringify(styles, null, 2))
  await writeFile(join(stepDir, 'network.json'), JSON.stringify(exchanges, null, 2))
  await writeFile(join(stepDir, 'console.json'), JSON.stringify({ consoleMessages, pageErrors }, null, 2))

  // Route inventory: crawl same-origin links from this page.
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')),
  )
  await page.close()
  return links.filter((href) => href && !href.startsWith('#') && !href.startsWith('mailto:'))
}

async function main() {
  const [, , baseUrl, outDir, ...seedRoutes] = process.argv
  if (!baseUrl || !outDir) {
    console.log('usage: node capture.mjs <base-url> <out-dir> [seed-route ...]')
    console.log('  Auth: log in once by hand and save storageState to', STORAGE_STATE_PATH, '(gitignored).')
    process.exit(1)
  }

  const browser = await chromium.launch()
  const contextOptions = {}
  try {
    contextOptions.storageState = STORAGE_STATE_PATH
  } catch {
    // No saved session — captures an unauthenticated view.
  }
  const context = await browser.newContext(contextOptions)

  const toVisit = [...new Set(seedRoutes.length > 0 ? seedRoutes : ['/'])]
  const visited = new Set()
  let stepNumber = 0

  while (toVisit.length > 0) {
    const route = toVisit.shift()
    const normalized = dropQueryString(route)
    if (visited.has(normalized)) continue
    visited.add(normalized)

    stepNumber++
    const stepDir = join(outDir, `step-${stepNumber}`)
    const links = await captureRoute(context, baseUrl, route, stepDir)
    for (const link of links) {
      if (!visited.has(dropQueryString(link))) toVisit.push(link)
    }
  }

  await browser.close()
  console.log(`captured ${stepNumber} route(s) into ${outDir}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
