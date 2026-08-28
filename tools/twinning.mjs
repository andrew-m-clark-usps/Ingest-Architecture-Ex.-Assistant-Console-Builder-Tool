/**
 * Parity between a legacy page and its rebuild.
 *
 * A missing element is a failure, never a default. The original sample fell
 * back to a hardcoded total, so a broken legacy page compared successfully
 * against a number somebody had typed into the harness.
 *
 * From Exec-Assistant.md Appendix A1 -- written as given.
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Read one selector, or say which side and which selector was missing. */
async function textOf(page, selector, side) {
  const el = page.locator(selector)
  if ((await el.count()) === 0) {
    throw new Error(`${side}: no element matched ${selector}`)
  }
  return (await el.first().innerText()).trim()
}

const write = (path, body) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, body)
}

/**
 * @param {object} o
 * @param {string} o.legacyUrl
 * @param {string} o.modernUrl
 * @param {{fill?:[string,string][], click?:string[], read:string}} o.legacy
 * @param {{fill?:[string,string][], click?:string[], read:string}} o.modern
 * @param {boolean} [o.screenshots]
 * @param {number} [o.elementDrift] absolute element-count difference tolerated.
 *   Default 150 is a starting point, not a measurement: set it from a run
 *   where the two pages are known to match, or it gets raised until it stops
 *   complaining.
 * @param {string} [o.outDir]
 */
export async function runTwinning(o) {
  const {
    legacyUrl, modernUrl, legacy, modern,
    screenshots = false, elementDrift = 150, outDir = 'artifacts/twinning',
  } = o

  const result = { status: 'PASS', errors: [], observed: {} }
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })

  const drive = async (page, url, steps, side) => {
    page.on('pageerror', (e) => result.errors.push(`${side} page error: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') result.errors.push(`${side} console: ${m.text()}`)
    })
    await page.goto(url, { waitUntil: 'networkidle' })
    for (const [sel, value] of steps.fill ?? []) await page.fill(sel, value)
    for (const sel of steps.click ?? []) await page.click(sel)
    // Wait for the app to settle, not for a fixed 500ms that is either wasted
    // or not enough depending on the machine.
    await page.waitForLoadState('networkidle')
    return textOf(page, steps.read, side)
  }

  try {
    const legacyPage = await context.newPage()
    const modernPage = await context.newPage()

    const legacyValue = await drive(legacyPage, legacyUrl, legacy, 'legacy')
    const modernValue = await drive(modernPage, modernUrl, modern, 'modern')
    result.observed = { legacyValue, modernValue }

    if (legacyValue !== modernValue) {
      result.errors.push(`value mismatch: legacy "${legacyValue}", modern "${modernValue}"`)
    }

    const count = (p) => p.evaluate(() => document.querySelectorAll('*').length)
    const [lc, mc] = [await count(legacyPage), await count(modernPage)]
    result.observed.elements = { legacy: lc, modern: mc, tolerated: elementDrift }
    if (Math.abs(lc - mc) > elementDrift) {
      result.errors.push(
        `element count drift ${Math.abs(lc - mc)} exceeds ${elementDrift} (legacy ${lc}, modern ${mc})`,
      )
    }

    if (screenshots) {
      mkdirSync(outDir, { recursive: true })
      await legacyPage.screenshot({ path: `${outDir}/legacy.png`, fullPage: true })
      await modernPage.screenshot({ path: `${outDir}/modern.png`, fullPage: true })
    }
  } catch (err) {
    result.errors.push(`run failed: ${err.message}`)
  } finally {
    await browser.close()
  }

  if (result.errors.length) {
    result.status = 'FAIL'
    write('artifacts/twinning/telemetry.json', JSON.stringify(result, null, 2))
  }
  return result
}

async function main() {
  const arg = (n) => {
    const i = process.argv.indexOf(`--${n}`)
    return i === -1 ? undefined : process.argv[i + 1]
  }
  const legacyUrl = arg('legacy')
  const modernUrl = arg('modern')
  if (!legacyUrl || !modernUrl) {
    console.error('usage: twinning.mjs --legacy <url> --modern <url> [--config <file>]')
    process.exit(2)
  }
  // Selectors belong to the page being tested, not to the harness. Without a
  // config the harness has nothing to drive and says so.
  const configPath = arg('config')
  if (!configPath) {
    console.error('--config is required: it names the selectors for each side')
    process.exit(2)
  }
  const cfg = JSON.parse((await import('node:fs')).readFileSync(configPath, 'utf8'))
  const result = await runTwinning({ legacyUrl, modernUrl, screenshots: true, ...cfg })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.status === 'PASS' ? 0 : 1)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
