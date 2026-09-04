import { test, expect, type Page } from '@playwright/test'

// See ../Console.md section 5 (quality gates): grids/exports/access
// model/metering/theme, all with zero console errors. Runs against the
// production build (see playwright.config.ts's webServer -- vite
// preview, not the dev server).

function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}

test('Hub loads with the first-hour checklist and no console errors', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Hub' })).toBeVisible()
  await expect(page.getByText('First-hour checklist')).toBeVisible()
  expect(errors).toEqual([])
})

test('Ledger grid renders sample data with the fixed closing balance', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/ledger')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  // Regression check for the "sum of per-account closing balances" bug
  // fix: ACCT-100 last posted balance 380 + ACCT-200 last posted balance
  // 955 = 1335 (see lib/ledger.test.ts for the unit-level version).
  await expect(page.getByText(/Closing balance: \$1,335\.00/)).toBeVisible()
  await expect(page.getByRole('table').first()).toBeVisible()
  expect(errors).toEqual([])
})

test('Ledger CSV export downloads a file', async ({ page }) => {
  await page.goto('/ledger')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('ledger-transactions.csv')
})

test('Usage metering dashboard renders the projected invoice', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/usage')
  await page.getByRole('button', { name: 'Load sample data' }).click()
  await expect(page.getByText('Projected invoice')).toBeVisible()
  expect(errors).toEqual([])
})

test('Gateway access model: adding a location assigns a new CRID', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/gateway')
  await page.getByLabel('Address').fill('123 Main St')
  await page.getByRole('button', { name: 'Add location (new CRID)' }).click()
  await expect(page.getByText(/CRID-\d+/)).toBeVisible()
  expect(errors).toEqual([])
})

test('Validator standardizes an address and reports Publication 28 compliance', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await page.goto('/validator')
  await expect(page.getByText(/Publication 28 compliant|Not Publication 28 compliant/)).toBeVisible()
  expect(errors).toEqual([])
})

test('dark theme is applied (no light variant, no toggle, by design)', async ({ page }) => {
  await page.goto('/')
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  const match = bg.match(/rgba?\((\d+), (\d+), (\d+)/)
  expect(match).not.toBeNull()
  const [, r, g, b] = match!.map(Number)
  // MUI's dark palette default background is near-black.
  expect(r).toBeLessThan(60)
  expect(g).toBeLessThan(60)
  expect(b).toBeLessThan(60)
})
